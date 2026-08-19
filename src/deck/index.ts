/**
 * Módulo M-02 `deck` — carregar, validar e versionar o deck (§5 de REQUISITOS.md);
 * comparar duas versões.
 *
 * O formato do cartão é CONGELADO pela §5. A aplicação não cria nem edita conteúdo.
 *
 * Contratos: C-9 (parser único na fronteira, devolve Result — nunca lança),
 *            C-15 (o diff da inicialização compara o guardado com o carregado).
 * Premissas: A-9 (deck cabe em memória), A-17 (limite validado, não suposto),
 *            A-2 (o `id` é a identidade do cartão entre versões).
 */

/**
 * Marca estrutural, declarada também em `progress`. TypeScript é estrutural, logo
 * as duas declarações unificam — o que evita uma aresta de dependência entre
 * `deck` e `progress` que a tabela de arquitetura não prevê.
 */
export type CardId = string & { readonly __brand: 'CardId' }

export type Card = {
  readonly id: CardId
  readonly hanzi: string
  readonly pinyin: string
  readonly gloss: string
}

export type Deck = {
  readonly version: number
  readonly cards: readonly Card[]
}

export type DeckDiff = {
  readonly added: CardId[]
  readonly removed: CardId[]
  readonly edited: CardId[]
}

export type DeckError =
  | { kind: 'not-object' }
  | { kind: 'bad-version'; got: unknown }
  | { kind: 'cards-not-array' }
  | { kind: 'too-many'; got: number; max: number }
  | { kind: 'bad-card'; index: number; field: string }
  | { kind: 'duplicate-id'; id: string }
  | { kind: 'fetch-failed'; status: number }
  | { kind: 'not-json'; message: string }

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

/** A-17: o teto de A-9 deixa de ser suposição e vira validação (ASS-03). */
export const MAX_CARDS = 5000

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/** C-9: valida forma; nunca lança. */
export function parseDeck(u: unknown): Result<Deck, DeckError> {
  if (typeof u !== 'object' || u === null) return err({ kind: 'not-object' })
  const raw = u as Record<string, unknown>

  if (typeof raw['version'] !== 'number' || !Number.isInteger(raw['version']) || raw['version'] < 1)
    return err({ kind: 'bad-version', got: raw['version'] })

  if (!Array.isArray(raw['cards'])) return err({ kind: 'cards-not-array' })
  const cards = raw['cards'] as unknown[]
  if (cards.length > MAX_CARDS)
    return err({ kind: 'too-many', got: cards.length, max: MAX_CARDS })

  const seen = new Set<string>()
  const parsed: Card[] = []

  for (let index = 0; index < cards.length; index++) {
    const c = cards[index]
    if (typeof c !== 'object' || c === null) return err({ kind: 'bad-card', index, field: '(card)' })
    const rec = c as Record<string, unknown>
    for (const field of ['id', 'hanzi', 'pinyin', 'gloss'] as const) {
      if (!nonEmptyString(rec[field])) return err({ kind: 'bad-card', index, field })
    }
    const id = rec['id'] as string
    if (seen.has(id)) return err({ kind: 'duplicate-id', id })
    seen.add(id)
    parsed.push({
      id: id as CardId,
      hanzi: rec['hanzi'] as string,
      pinyin: rec['pinyin'] as string,
      gloss: rec['gloss'] as string,
    })
  }

  return ok({ version: raw['version'], cards: parsed })
}

export type FetchLike = (input: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

/** O deck é arquivo estático servido pela aplicação (decisão de P0). */
export async function loadDeck(fetchFn: FetchLike, url = '/deck.json'): Promise<Result<Deck, DeckError>> {
  let res: Awaited<ReturnType<FetchLike>>
  try {
    res = await fetchFn(url)
  } catch (e) {
    return err({ kind: 'not-json', message: e instanceof Error ? e.message : String(e) })
  }
  if (!res.ok) return err({ kind: 'fetch-failed', status: res.status })
  try {
    return parseDeck(await res.json())
  } catch (e) {
    return err({ kind: 'not-json', message: e instanceof Error ? e.message : String(e) })
  }
}

/**
 * Compara duas versões do deck (§6 Inc.2).
 *
 * `edited` usa o `id` como identidade (A-2): mesmo id com conteúdo diferente é o
 * MESMO cartão corrigido, e seu progresso é preservado intacto. `removed` não
 * implica apagar progresso — o log sobrevive a qualquer versão de deck (C-8),
 * então o cartão apenas sai da fila.
 */
export function diffDecks(prev: Deck, next: Deck): DeckDiff {
  const before = new Map(prev.cards.map((c) => [c.id, c]))
  const after = new Map(next.cards.map((c) => [c.id, c]))

  const added: CardId[] = []
  const edited: CardId[] = []
  for (const [id, card] of after) {
    const old = before.get(id)
    if (!old) added.push(id)
    else if (old.hanzi !== card.hanzi || old.pinyin !== card.pinyin || old.gloss !== card.gloss)
      edited.push(id)
  }

  const removed: CardId[] = []
  for (const id of before.keys()) if (!after.has(id)) removed.push(id)

  return { added, removed, edited }
}
