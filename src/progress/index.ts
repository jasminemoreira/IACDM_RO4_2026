/**
 * Módulo M-03 `progress` — álgebra do log de revisões: validar, ordenar, unir, projetar.
 *
 * INVARIANTE CENTRAL (C-3, A-4): `{n, EF, I}` é FUNÇÃO PURA do log daquele cartão
 * pela §4. A revisão é o dado primário; o estado do cartão é cálculo, nunca verdade
 * persistida. É isso que faz "nenhum dos dois lados perde revisões já registradas"
 * (§6 Inc.3) ser propriedade estrutural em vez de cuidado de implementação.
 *
 * Contratos: C-2 (Review imutável e append-only; eventId é a chave da união),
 *            C-4 (ordem canônica: atEpochMs, deviceId, eventId),
 *            C-5 (union comutativa, associativa, idempotente — G-Set/CRDT),
 *            C-9 (parser de fronteira; valida forma e FAIXA, nunca pertinência ao deck),
 *            C-14 (applyOne: derivação incremental equivalente ao replay).
 */

import {
  applyReview,
  INITIAL,
  isGrade,
  isLocalDay,
  nextDueDay,
  type Days,
  type Grade,
  type LocalDay,
  type SchedState,
} from '../scheduler/index.ts'

/** Marca estrutural; ver a nota em `deck` sobre por que é declarada nos dois. */
export type CardId = string & { readonly __brand: 'CardId' }
export type EventId = string & { readonly __brand: 'EventId' }
export type DeviceId = string & { readonly __brand: 'DeviceId' }
/** Milissegundos desde a época. NUNCA segundos — a ambiguidade era LING-01. */
export type EpochMs = number & { readonly __brand: 'EpochMs' }

export type Review = {
  readonly eventId: EventId
  readonly cardId: CardId
  readonly q: Grade
  readonly atEpochMs: EpochMs
  readonly localDay: LocalDay
  readonly deviceId: DeviceId
}

export type CardState = SchedState & {
  readonly cardId: CardId
  /** `null` = nunca revisado = devido agora. */
  readonly dueDay: LocalDay | null
}

export type ReviewError =
  | { kind: 'not-object' }
  | { kind: 'bad-field'; field: keyof Review }
  | { kind: 'future'; atEpochMs: number; limit: number }

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

/** SEC-05: tolerância de relógio para eventos que chegam de outro dispositivo. */
export const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.length > 0

/**
 * C-9: valida FORMA e FAIXA de um evento que cruzou fronteira externa.
 *
 * ASS-06 — o que este parser deliberadamente NÃO faz: rejeitar `cardId` que não
 * esteja no deck corrente. O log sobrevive a qualquer versão de deck, e um cartão
 * removido na v2 tem revisões históricas legítimas que a decisão de P0 mandou
 * preservar. Pertencer ao deck corrente nunca foi critério de validade.
 */
export function parseReview(u: unknown, nowEpochMs: number): Result<Review, ReviewError> {
  if (typeof u !== 'object' || u === null) return err({ kind: 'not-object' })
  const r = u as Record<string, unknown>

  if (!nonEmpty(r['eventId'])) return err({ kind: 'bad-field', field: 'eventId' })
  if (!nonEmpty(r['cardId'])) return err({ kind: 'bad-field', field: 'cardId' })
  if (!nonEmpty(r['deviceId'])) return err({ kind: 'bad-field', field: 'deviceId' })
  if (!isGrade(r['q'])) return err({ kind: 'bad-field', field: 'q' })
  if (!isLocalDay(r['localDay'])) return err({ kind: 'bad-field', field: 'localDay' })

  const at = r['atEpochMs']
  if (typeof at !== 'number' || !Number.isFinite(at) || at <= 0)
    return err({ kind: 'bad-field', field: 'atEpochMs' })

  const limit = nowEpochMs + FUTURE_TOLERANCE_MS
  if (at > limit) return err({ kind: 'future', atEpochMs: at, limit })

  return ok({
    eventId: r['eventId'] as EventId,
    cardId: r['cardId'] as CardId,
    q: r['q'],
    atEpochMs: at as EpochMs,
    localDay: r['localDay'],
    deviceId: r['deviceId'] as DeviceId,
  })
}

/**
 * C-4 — ordem total determinística e independente de quem reconcilia.
 *
 * O desempate por `deviceId` e `eventId` é arbitrário mas ESTÁVEL (MEC-06), e
 * estabilidade é exatamente o que a convergência exige. Não se assume relógio
 * sincronizado entre dispositivos (A-1); por isso o desempate é triplo.
 */
export function canonicalOrder(a: Review, b: Review): number {
  if (a.atEpochMs !== b.atEpochMs) return a.atEpochMs - b.atEpochMs
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1
  if (a.eventId !== b.eventId) return a.eventId < b.eventId ? -1 : 1
  return 0
}

/**
 * C-5 — união de conjunto por `eventId`. Comutativa, associativa e idempotente:
 * é um G-Set, e é daí que vem a convergência sem coordenação.
 * O resultado sai em ordem canônica.
 */
export function union(a: readonly Review[], b: readonly Review[]): Review[] {
  const byId = new Map<EventId, Review>()
  for (const r of a) byId.set(r.eventId, r)
  for (const r of b) if (!byId.has(r.eventId)) byId.set(r.eventId, r)
  return [...byId.values()].sort(canonicalOrder)
}

function withDue(cardId: CardId, s: SchedState, lastDay: LocalDay | null): CardState {
  return {
    cardId,
    n: s.n,
    ef: s.ef,
    i: s.i,
    dueDay: lastDay === null ? null : nextDueDay(lastDay, s.i as Days),
  }
}

/**
 * Replay: aplica a §4 sobre o log daquele cartão, em ordem canônica.
 * `reviews` pode vir em qualquer ordem — a ordenação acontece aqui.
 */
export function projectCard(cardId: CardId, reviews: readonly Review[]): CardState {
  const ordered = [...reviews].sort(canonicalOrder)
  let s: SchedState = INITIAL
  let lastDay: LocalDay | null = null
  for (const r of ordered) {
    s = applyReview(s, r.q)
    lastDay = r.localDay
  }
  return withDue(cardId, s, lastDay)
}

/** Projeta o log inteiro de uma vez. C-14: roda uma vez por montagem de fila. */
export function projectAll(reviews: readonly Review[]): Map<CardId, CardState> {
  const byCard = new Map<CardId, Review[]>()
  for (const r of reviews) {
    const list = byCard.get(r.cardId)
    if (list) list.push(r)
    else byCard.set(r.cardId, [r])
  }
  const out = new Map<CardId, CardState>()
  for (const [cardId, rs] of byCard) out.set(cardId, projectCard(cardId, rs))
  return out
}

/**
 * C-14 — derivação incremental, O(1) por nota, em vez de replay O(log).
 *
 * NÃO é cache: é equivalente ao replay porque o evento novo é o mais recente
 * daquele cartão e a ordem canônica o coloca por último (A-18: dentro de um
 * dispositivo o relógio não retrocede durante a sessão). Se o relógio retroceder,
 * a próxima montagem de fila — que faz o replay completo — corrige.
 */
export function applyOne(s: CardState, r: Review): CardState {
  return withDue(s.cardId, applyReview({ n: s.n, ef: s.ef, i: s.i }, r.q), r.localDay)
}

/** Estado de um cartão sem revisão alguma: devido agora. */
export function initialState(cardId: CardId): CardState {
  return withDue(cardId, INITIAL, null)
}
