/**
 * Módulo M-04 `storage` — portas de persistência e seus adaptadores.
 *
 * Nenhuma regra de domínio vive aqui. O módulo GUARDA o `deviceId`; quem o CRIA é
 * a raiz de composição (`main.ts`) — criar identidade não é persistir (ARQ-07).
 *
 * Incremento 1 (§6): "sem persistência além da sessão em memória" — este arquivo
 * entrega as portas e o adaptador em memória. O adaptador IndexedDB entra no
 * Incremento 2 sem que nenhum módulo do núcleo mude, que é o ponto de ter porta.
 *
 * Contratos: C-2 (append-only: não há remove nem update),
 *            C-6 (só `import type` do domínio — nada de dependência de valor).
 */

import type { Deck } from '../deck/index.ts'
import type { CardId, DeviceId, Review } from '../progress/index.ts'

export type StorageError =
  | { kind: 'unavailable'; message: string }
  | { kind: 'blocked' }
  | { kind: 'quota-exceeded' }
  | { kind: 'upgrade-failed'; message: string }
  | { kind: 'write-failed'; message: string }

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export type QuotaInfo = {
  readonly usageBytes: number
  readonly quotaBytes: number
  readonly persisted: boolean
}

/** C-2: append-only. Deliberadamente sem `remove` e sem `update`. */
export type ReviewRepository = {
  append(r: Review): Promise<Result<void, StorageError>>
  appendMany(rs: readonly Review[]): Promise<Result<void, StorageError>>
  all(): Promise<readonly Review[]>
  byCard(id: CardId): Promise<readonly Review[]>
}

export type DeckRepository = {
  /** C-15: chamado a cada carga bem-sucedida, para que o diff tenha o anterior. */
  save(d: Deck): Promise<Result<void, StorageError>>
  load(): Promise<Deck | null>
}

export type MetaRepository = {
  deckVersion(): Promise<number | null>
  setDeckVersion(v: number): Promise<Result<void, StorageError>>
  /** Guarda o que a raiz de composição criou; não gera identidade (ARQ-07). */
  deviceId(): Promise<DeviceId | null>
  setDeviceId(id: DeviceId): Promise<Result<void, StorageError>>
}

export type Repositories = {
  readonly reviews: ReviewRepository
  readonly decks: DeckRepository
  readonly meta: MetaRepository
  /** C-19: tem consumidor e limiar — capacidade sem consumidor seria API morta. */
  estimateQuota(): Promise<QuotaInfo>
}

const ok: Result<void, never> = { ok: true, value: undefined }

/**
 * Adaptador do Incremento 1: tudo em memória, morre com a aba.
 * É exatamente o que a §6 Inc.1 pede — e o mesmo objeto serve de duplo nos testes.
 */
export function createMemoryRepositories(): Repositories {
  const reviews: Review[] = []
  let deck: Deck | null = null
  let deckVersion: number | null = null
  let deviceId: DeviceId | null = null

  return {
    reviews: {
      async append(r) {
        reviews.push(r)
        return ok
      },
      async appendMany(rs) {
        reviews.push(...rs)
        return ok
      },
      async all() {
        return [...reviews]
      },
      async byCard(id) {
        return reviews.filter((r) => r.cardId === id)
      },
    },
    decks: {
      async save(d) {
        deck = d
        return ok
      },
      async load() {
        return deck
      },
    },
    meta: {
      async deckVersion() {
        return deckVersion
      },
      async setDeckVersion(v) {
        deckVersion = v
        return ok
      },
      async deviceId() {
        return deviceId
      },
      async setDeviceId(id) {
        deviceId = id
        return ok
      },
    },
    async estimateQuota() {
      return { usageBytes: 0, quotaBytes: 0, persisted: false }
    },
  }
}

/** Adaptador de produção (Incremento 2). O núcleo não sabe que ele existe. */
export { openDb, createIndexedDbRepositories } from './indexeddb.ts'
