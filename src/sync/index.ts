/**
 * Módulo M-05 `sync` — transporte e procedimento de sincronização.
 *
 * O núcleo da reconciliação NÃO vive aqui: `union`, `canonicalOrder` e
 * `parseReview` pertencem a `progress` (correção de ARQ-03 na Fase 3). Este
 * módulo é só a porta, seu adaptador e o passo a passo.
 *
 * C-10 — o procedimento, e por que ele basta:
 *     pull → union(local, remoto) → anexar ao local o que falta → merge(log local)
 *   Como a união é idempotente e nada é jamais removido, uma revisão anexada
 *   DURANTE a sincronização entra nesta rodada ou na próxima — em nenhum caso é
 *   perdida ou duplicada. Não é preciso trava nem transação distribuída: a
 *   propriedade vem do log ser append-only.
 *
 * LING-05 — o método do remoto chama-se `merge`, não `push`, e o contrato diz o
 *   que o nome promete: o remoto UNE o que recebe com o que já tem, NUNCA
 *   substitui. Um merge obsoleto é inofensivo. Se fosse substituição, um
 *   dispositivo que empurrasse um log capturado antes apagaria do remoto os
 *   eventos do outro — a perda que a §6 Inc.3 proíbe, entrando pela porta do
 *   transporte.
 *
 * C-8 (revisado) — o duplo local NÃO é backup e não promete durabilidade: mora na
 *   mesma origem, então a evicção o leva junto com o log primário (RES-06). Ele
 *   existe para exercitar a reconciliação, que é o que a §6 Inc.3 diz importar.
 *
 * PERF-02/SUS-03 — a troca do log ÍNTEGRO é deliberada: é o mecanismo de reparo
 *   de C-8. Sync incremental está no escopo negativo por quebrá-lo.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { parseReview, union, type Review } from '../progress/index.ts'
import type { Repositories } from '../storage/index.ts'

/** `pull` devolve `unknown[]` de propósito: obriga o parser de fronteira (C-9). */
export type Transport = {
  pull(): Promise<unknown[]>
  merge(rs: readonly Review[]): Promise<void>
}

export type SyncReport = {
  readonly pulled: number
  readonly rejected: number
  readonly merged: number
  readonly localBefore: number
  readonly localAfter: number
  readonly pushed: number
}

/**
 * C-10. `now` é injetado (não lido do relógio aqui) para manter a operação
 * determinística e testável; serve de referência para a tolerância de futuro de
 * `parseReview` (SEC-05).
 */
export async function sync(repos: Repositories, transport: Transport, now: number): Promise<SyncReport> {
  const localBefore = await repos.reviews.all()
  const known = new Set(localBefore.map((r) => r.eventId))

  const raw = await transport.pull()
  const accepted: Review[] = []
  let rejected = 0
  for (const item of raw) {
    const parsed = parseReview(item, now)
    if (parsed.ok) accepted.push(parsed.value)
    else rejected++
  }

  const merged = union(localBefore, accepted)
  const missing = merged.filter((r) => !known.has(r.eventId))
  if (missing.length > 0) await repos.reviews.appendMany(missing)

  // O remoto UNE o que recebe (LING-05). Enviar o log íntegro é o reparo de C-8.
  await transport.merge(merged)

  return {
    pulled: raw.length,
    rejected,
    merged: missing.length,
    localBefore: localBefore.length,
    localAfter: merged.length,
    pushed: merged.length,
  }
}

const REMOTE_DB = 'hanzi-pwa-remote'

interface RemoteSchema extends DBSchema {
  reviews: { key: string; value: Review }
}

/**
 * Adaptador "duplo local": um segundo armazenamento que faz o papel do remoto.
 * Banco SEPARADO do primário — isola corrupção lógica, mas note bem: mesma
 * origem, logo NÃO isola evicção (é o que C-8 revisado admite).
 */
export async function createLocalDoubleTransport(): Promise<Transport> {
  const db: IDBPDatabase<RemoteSchema> = await openDB<RemoteSchema>(REMOTE_DB, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('reviews'))
        database.createObjectStore('reviews', { keyPath: 'eventId' })
    },
  })

  return {
    async pull() {
      return db.getAll('reviews')
    },
    /** União, jamais substituição: `put` por `eventId` é exatamente isso. */
    async merge(rs) {
      const tx = db.transaction('reviews', 'readwrite')
      await Promise.all([...rs.map((r) => tx.store.put(r)), tx.done])
    },
  }
}

/** Transporte em memória — o mesmo contrato, para teste sem navegador (C-6). */
export function createMemoryTransport(seed: readonly Review[] = []): Transport {
  const store = new Map<string, Review>(seed.map((r) => [r.eventId, r]))
  return {
    async pull() {
      return [...store.values()]
    },
    async merge(rs) {
      for (const r of rs) store.set(r.eventId, r) // une, não substitui
    },
  }
}

/**
 * Eventos do dispositivo B do cenário de conflito descrito em
 * `specs/datasets/cenario-conflito.md`, com ids e instantes FIXOS.
 *
 * Existe para tornar a §6 Inc.3 verificável por uma pessoa: um só navegador é um
 * só dispositivo, então sem semear o duplo local não há divergência para
 * reconciliar. Não é funcionalidade — não tem interface, e só escreve no remoto,
 * nunca no log primário.
 */
export function conflictScenarioEvents(): Review[] {
  const mk = (eventId: string, cardId: string, q: number, atEpochMs: number): Review =>
    ({ eventId, cardId, q, atEpochMs, localDay: '2026-08-18', deviceId: 'bbbbbbbb-0000-4000-8000-000000000002' }) as unknown as Review
  return [
    mk('e3-0000-4000-8000-000000000003', 'c001', 0, 1_787_000_030_000),
    mk('e4-0000-4000-8000-000000000004', 'c003', 3, 1_787_000_090_000),
  ]
}
