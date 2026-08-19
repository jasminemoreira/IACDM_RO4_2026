/**
 * Módulo M-06 `session` — serviço de aplicação: fila de devidos, máquina de estados
 * da sessão, registro de nota, diff de versão do deck na inicialização.
 *
 * Contratos: C-14 (não guarda projeção em cache; recomputa por montagem de fila,
 *                  e usa applyOne — O(1) — ao registrar nota),
 *            C-15 (o diff roda aqui, na inicialização, com dono e momento únicos),
 *            C-16 (o estado `writing` tem prazo de 5 s),
 *            C-18 (assinatura única: grade(q); o cardId vem do estado da sessão),
 *            C-20 (syncNow alcançável de qualquer estado).
 * EDGE-6: nenhum estado de sessão é persistido — após recarga a fila é recomputada.
 */

import { diffDecks, type Card, type Deck, type DeckDiff } from '../deck/index.ts'
import {
  applyOne,
  initialState,
  projectAll,
  type CardId,
  type CardState,
  type DeviceId,
  type EpochMs,
  type EventId,
  type Review,
} from '../progress/index.ts'
import { isDue, localDayOf, type Grade, type LocalDay } from '../scheduler/index.ts'
import type { Repositories, StorageError } from '../storage/index.ts'

export type SessionState = 'loading' | 'queue-empty' | 'showing' | 'revealed' | 'writing' | 'done' | 'error'

export type SessionView =
  | { state: 'loading' }
  | { state: 'queue-empty'; nextDueDay: LocalDay | null; reviewed: number }
  | { state: 'showing'; card: Card; index: number; total: number }
  | { state: 'revealed'; card: Card; index: number; total: number }
  | { state: 'writing'; card: Card; index: number; total: number }
  | { state: 'done'; reviewed: number }
  | { state: 'error'; kind: 'deck' | 'storage' | 'sync'; message: string }

export type SyncReport = {
  pulled: number
  rejected: number
  merged: number
  localBefore: number
  localAfter: number
  pushed: number
}

export type SessionApi = {
  view(): SessionView
  reveal(): void
  grade(q: Grade): Promise<void>
  syncNow(): Promise<void>
  onChange(listener: () => void): void
}

export type Clock = () => Date
export type Ids = () => string

export type SessionDeps = {
  readonly repos: Repositories
  readonly deviceId: DeviceId
  readonly clock: Clock
  readonly newId: Ids
  /** Injetado no Incremento 3; ausente aqui é o comportamento do Incremento 1. */
  readonly sync?: () => Promise<SyncReport>
}

/** C-16: prazo do estado `writing` antes de cair em `error` (PROC-05). */
export const WRITE_TIMEOUT_MS = 5000

/** C-19: acima disso a interface avisa (OBS-04). */
export const QUOTA_WARN_RATIO = 0.8

function timeout(ms: number): Promise<{ ok: false; error: StorageError }> {
  return new Promise((resolve) =>
    setTimeout(() => resolve({ ok: false, error: { kind: 'write-failed', message: `sem resposta em ${ms} ms` } }), ms),
  )
}

export class Session implements SessionApi {
  #view: SessionView = { state: 'loading' }
  #queue: Card[] = []
  #cursor = 0
  #reviewed = 0
  #states = new Map<CardId, CardState>()
  #deck: Deck | null = null
  #listeners: Array<() => void> = []
  #lastDiff: DeckDiff | null = null
  #quotaWarning = false

  constructor(private readonly deps: SessionDeps) {}

  view(): SessionView {
    return this.#view
  }

  onChange(listener: () => void): void {
    this.#listeners.push(listener)
  }

  lastDeckDiff(): DeckDiff | null {
    return this.#lastDiff
  }

  quotaWarning(): boolean {
    return this.#quotaWarning
  }

  #emit(v: SessionView): void {
    this.#view = v
    for (const l of this.#listeners) l()
  }

  #today(): LocalDay {
    return localDayOf(this.deps.clock())
  }

  /**
   * C-15: dono e momento únicos do diff de versão do deck. Comparar o guardado com
   * o carregado; nenhum dado é migrado, porque o log independe do deck.
   */
  async start(deck: Deck): Promise<void> {
    const { repos } = this.deps
    const previous = await repos.decks.load()
    this.#lastDiff = previous ? diffDecks(previous, deck) : null
    await repos.decks.save(deck)
    await repos.meta.setDeckVersion(deck.version)
    this.#deck = deck

    const quota = await repos.estimateQuota()
    this.#quotaWarning = quota.quotaBytes > 0 && quota.usageBytes / quota.quotaBytes > QUOTA_WARN_RATIO

    await this.rebuildQueue()
  }

  /**
   * C-14 + EDGE-6: a fila é derivada do log persistido, uma vez por montagem.
   * Cartões já revisados hoje deixaram de estar devidos e não reaparecem — é isso
   * que faz a sessão sobreviver a uma recarga sem persistir estado de sessão.
   */
  async rebuildQueue(): Promise<void> {
    if (!this.#deck) return
    const reviews = await this.deps.repos.reviews.all()
    this.#states = projectAll(reviews)
    this.#queue = buildQueue(this.#deck, this.#states, this.#today())
    this.#cursor = 0
    this.#showCurrent()
  }

  #showCurrent(): void {
    const card = this.#queue[this.#cursor]
    if (!card) {
      if (this.#reviewed > 0) this.#emit({ state: 'done', reviewed: this.#reviewed })
      else this.#emit({ state: 'queue-empty', nextDueDay: this.#nextDueDay(), reviewed: 0 })
      return
    }
    this.#emit({ state: 'showing', card, index: this.#cursor + 1, total: this.#queue.length })
  }

  /** UX-02: a tela vazia diz QUANDO o próximo cartão vence, em vez de ser beco sem saída. */
  #nextDueDay(): LocalDay | null {
    let soonest: LocalDay | null = null
    for (const s of this.#states.values()) {
      if (s.dueDay === null) continue
      if (soonest === null || s.dueDay < soonest) soonest = s.dueDay
    }
    return soonest
  }

  reveal(): void {
    const v = this.#view
    if (v.state !== 'showing') return // PROC-02: transição órfã é ignorada, não indefinida
    this.#emit({ state: 'revealed', card: v.card, index: v.index, total: v.total })
  }

  /** C-18: o cardId vem do estado corrente, nunca do chamador. */
  async grade(q: Grade): Promise<void> {
    const v = this.#view
    if (v.state !== 'revealed') return // UX-04/MEC-04: clique duplo não gera segundo evento
    const card = v.card
    this.#emit({ state: 'writing', card, index: v.index, total: v.total })

    const now = this.deps.clock()
    const review: Review = {
      eventId: this.deps.newId() as EventId,
      cardId: card.id,
      q,
      atEpochMs: now.getTime() as EpochMs,
      localDay: localDayOf(now),
      deviceId: this.deps.deviceId,
    }

    // A-11 + C-16: durável antes de avançar, com prazo.
    const written = await Promise.race([this.deps.repos.reviews.append(review), timeout(WRITE_TIMEOUT_MS)])
    if (!written.ok) {
      this.#emit({ state: 'error', kind: 'storage', message: describe(written.error) })
      return
    }

    // C-14: derivação incremental do cartão afetado — O(1), não replay.
    const before = this.#states.get(review.cardId) ?? initialState(review.cardId)
    this.#states.set(review.cardId, applyOne(before, review))

    this.#reviewed++
    this.#cursor++
    this.#showCurrent()
  }

  /** C-20: alcançável de qualquer estado — inclusive no meio de uma fila enorme. */
  async syncNow(): Promise<void> {
    if (!this.deps.sync) return
    try {
      await this.deps.sync()
      await this.rebuildQueue()
    } catch (e) {
      this.#emit({ state: 'error', kind: 'sync', message: e instanceof Error ? e.message : String(e) })
    }
  }

  fail(kind: 'deck' | 'storage' | 'sync', message: string): void {
    this.#emit({ state: 'error', kind, message })
  }
}

function describe(e: StorageError): string {
  switch (e.kind) {
    case 'unavailable':
      return `armazenamento indisponível: ${e.message}`
    case 'blocked':
      return 'outra aba está com uma versão anterior aberta — feche-a e recarregue'
    case 'quota-exceeded':
      return 'espaço de armazenamento esgotado'
    case 'upgrade-failed':
      return `falha ao atualizar o banco local: ${e.message}`
    case 'write-failed':
      return `falha ao gravar a revisão: ${e.message}`
  }
}

/**
 * §6 Inc.1: "o agendador apresenta apenas os cartões devidos".
 * Sem teto diário — CTRL-02 foi decidido pelo operador como comportamento aceito.
 * A ordem é a do deck: estável e reproduzível.
 */
export function buildQueue(deck: Deck, states: Map<CardId, CardState>, today: LocalDay): Card[] {
  return deck.cards.filter((c) => {
    const s = states.get(c.id)
    return isDue(s ? s.dueDay : null, today)
  }) as Card[]
}
