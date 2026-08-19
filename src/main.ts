/**
 * Raiz de composição — a única camada que conhece todos os módulos.
 *
 * ARQ-07: o `deviceId` é CRIADO aqui, com crypto.randomUUID(), e entregue a
 * `storage` para guardar. Criar identidade não é persistir.
 * C-12: uma vez copiado para dentro de um evento, o deviceId é imutável ali —
 * regenerá-lo após evicção afeta só eventos futuros e não altera a ordem canônica
 * dos existentes.
 * A-12: crypto.randomUUID() existe em contexto seguro, o mesmo que o service
 * worker já exige (A-5) — nenhuma dependência nova.
 */

import { loadDeck, type DeckError } from './deck/index.ts'
import type { DeviceId } from './progress/index.ts'
import { registerServiceWorker } from './service-worker/index.ts'
import { Session } from './session/index.ts'
import {
  createIndexedDbRepositories,
  createMemoryRepositories,
  openDb,
  type Repositories,
  type StorageError,
} from './storage/index.ts'
import { mount } from './ui/index.ts'

async function resolveDeviceId(repos: Repositories): Promise<DeviceId> {
  const existing = await repos.meta.deviceId()
  if (existing) return existing
  const fresh = crypto.randomUUID() as DeviceId
  await repos.meta.setDeviceId(fresh)
  return fresh
}

async function boot(): Promise<void> {
  const root = document.getElementById('app')
  if (!root) throw new Error('elemento #app ausente')

  let offlineReady = false

  // Incremento 2: persistência real. A troca do adaptador não toca em nenhum
  // módulo do núcleo — é para isso que a porta existe.
  const db = await openDb()
  const repos: Repositories = db.ok ? createIndexedDbRepositories(db.value) : createMemoryRepositories()

  const deviceId = await resolveDeviceId(repos)

  const session = new Session({
    repos,
    deviceId,
    clock: () => new Date(),
    newId: () => crypto.randomUUID(),
  })

  mount(root, session, {
    quotaWarning: () => session.quotaWarning(),
    offlineReady: () => offlineReady,
  })

  registerServiceWorker({
    onOfflineReady() {
      offlineReady = true
      session.notifyChange()
    },
  })

  // RES-02: falha de armazenamento é explícita e visível, nunca quebra silenciosa.
  if (!db.ok) {
    session.fail('storage', describeStorageError(db.error))
    return
  }

  const deck = await loadDeck((url) => fetch(url))
  if (!deck.ok) {
    session.fail('deck', describeDeckError(deck.error))
    return
  }
  await session.start(deck.value)
}

function describeStorageError(e: StorageError): string {
  switch (e.kind) {
    case 'unavailable':
      return `o armazenamento local não está disponível (${e.message}). Em janela anônima isso é esperado.`
    case 'blocked':
      return 'outra aba está com uma versão anterior do banco aberta — feche-a e recarregue'
    case 'quota-exceeded':
      return 'o espaço de armazenamento do navegador está esgotado'
    case 'upgrade-failed':
      return `falha ao atualizar o banco local: ${e.message}`
    case 'write-failed':
      return `falha ao gravar: ${e.message}`
  }
}

function describeDeckError(e: DeckError): string {
  switch (e.kind) {
    case 'fetch-failed':
      return `não foi possível buscar o baralho (HTTP ${e.status})`
    case 'not-json':
      return `o baralho não é JSON válido: ${e.message}`
    case 'bad-card':
      return `cartão inválido na posição ${e.index}, campo "${e.field}"`
    case 'duplicate-id':
      return `o baralho tem o id "${e.id}" repetido`
    case 'too-many':
      return `o baralho tem ${e.got} cartões; o máximo é ${e.max}`
    case 'bad-version':
      return 'o baralho não declara uma versão válida'
    case 'cards-not-array':
      return 'o baralho não traz uma lista de cartões'
    case 'not-object':
      return 'o baralho não é um objeto'
  }
}

void boot()
