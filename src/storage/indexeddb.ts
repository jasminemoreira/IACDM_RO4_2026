/**
 * Adaptador IndexedDB do módulo M-04 `storage` (Incremento 2).
 *
 * localStorage está tecnicamente descartado, não por preferência: a MDN diz que
 * Web Storage NÃO pode ser usado dentro de um service worker
 * (specs/technical/persistencia-browser.md).
 *
 * Object stores (IMP-05):
 *   reviews — keyPath 'eventId', índice 'by-card' em cardId. Append-only (C-2).
 *   deck    — keyPath 'version'. Guarda cada versão carregada, para o diff (C-15).
 *   meta    — chave-valor: deckVersion, deviceId.
 *
 * ARQ-04: o upgrade de esquema pertence a quem ABRE o banco — é aqui, não em
 * outro módulo. RES-04: o evento `blocked` do idb vira erro próprio, com mensagem
 * acionável. RES-02: cota estourada é erro nomeado, não quebra silenciosa.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Deck } from '../deck/index.ts'
import type { CardId, DeviceId, Review } from '../progress/index.ts'
import type { QuotaInfo, Repositories, Result, StorageError } from './index.ts'

const DB_NAME = 'hanzi-pwa'
const DB_VERSION = 1

interface Schema extends DBSchema {
  reviews: { key: string; value: Review; indexes: { 'by-card': string } }
  deck: { key: number; value: Deck }
  meta: { key: string; value: string | number }
}

const ok: Result<void, never> = { ok: true, value: undefined }

function toStorageError(e: unknown): StorageError {
  const name = e instanceof Error ? e.name : ''
  if (name === 'QuotaExceededError') return { kind: 'quota-exceeded' }
  return { kind: 'write-failed', message: e instanceof Error ? e.message : String(e) }
}

async function guard(op: () => Promise<unknown>): Promise<Result<void, StorageError>> {
  try {
    await op()
    return ok
  } catch (e) {
    return { ok: false, error: toStorageError(e) }
  }
}

export async function openDb(): Promise<Result<IDBPDatabase<Schema>, StorageError>> {
  if (typeof indexedDB === 'undefined')
    return { ok: false, error: { kind: 'unavailable', message: 'IndexedDB não existe neste contexto' } }

  let wasBlocked = false
  try {
    const db = await openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('reviews')) {
          const reviews = database.createObjectStore('reviews', { keyPath: 'eventId' })
          reviews.createIndex('by-card', 'cardId')
        }
        if (!database.objectStoreNames.contains('deck'))
          database.createObjectStore('deck', { keyPath: 'version' })
        if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta')
      },
      // RES-04: outra aba segura uma versão anterior do esquema.
      blocked() {
        wasBlocked = true
      },
    })
    return { ok: true, value: db }
  } catch (e) {
    if (wasBlocked) return { ok: false, error: { kind: 'blocked' } }
    return {
      ok: false,
      error: { kind: 'upgrade-failed', message: e instanceof Error ? e.message : String(e) },
    }
  }
}

export function createIndexedDbRepositories(db: IDBPDatabase<Schema>): Repositories {
  return {
    reviews: {
      // C-2: só append. Não existe remove nem update, nem aqui nem na porta.
      append: (r) => guard(() => db.put('reviews', r)),
      appendMany: (rs) =>
        guard(async () => {
          const tx = db.transaction('reviews', 'readwrite')
          await Promise.all([...rs.map((r) => tx.store.put(r)), tx.done])
        }),
      all: () => db.getAll('reviews'),
      byCard: (id: CardId) => db.getAllFromIndex('reviews', 'by-card', id),
    },
    decks: {
      // C-15: cada carga bem-sucedida é guardada, então o diff sempre tem o anterior.
      save: (d) => guard(() => db.put('deck', d)),
      async load() {
        const all = await db.getAll('deck')
        if (all.length === 0) return null
        // MIG-02: o deck carregado é a autoridade; o guardado de maior versão é a
        // referência para o diff, e retroceder de versão é aceito.
        return all.reduce((a, b) => (b.version > a.version ? b : a))
      },
    },
    meta: {
      async deckVersion() {
        const v = await db.get('meta', 'deckVersion')
        return typeof v === 'number' ? v : null
      },
      setDeckVersion: (v) => guard(() => db.put('meta', v, 'deckVersion')),
      async deviceId() {
        const v = await db.get('meta', 'deviceId')
        return typeof v === 'string' ? (v as DeviceId) : null
      },
      setDeviceId: (id) => guard(() => db.put('meta', id, 'deviceId')),
    },
    // C-19: tem consumidor (session, na inicialização) e limiar (80%).
    async estimateQuota(): Promise<QuotaInfo> {
      if (typeof navigator === 'undefined' || !navigator.storage?.estimate)
        return { usageBytes: 0, quotaBytes: 0, persisted: false }
      const est = await navigator.storage.estimate()
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false
      return { usageBytes: est.usage ?? 0, quotaBytes: est.quota ?? 0, persisted }
    },
  }
}
