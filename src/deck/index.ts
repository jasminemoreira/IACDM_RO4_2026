/**
 * deck — a entrada imutável, no formato exato da §5 de REQUISITOS.md.
 *
 * A §5 fixa o deck como ARRAY PURO de cartões, sem invólucro e sem campo de versão.
 * Por isso a versão é DERIVADA do conteúdo, nunca lida do arquivo — decisão da Fase 0,
 * registrada em specs/datasets/README.md.
 *
 * Puro: sem I/O. Quem lê o arquivo é `app`.
 */

export type CardId = string;

export type Card = {
  readonly id: CardId;
  readonly hanzi: string;
  readonly pinyin: string;
  readonly gloss: string;
};

export type Deck = {
  /** derivada por FNV-1a sobre a forma canônica; não vem do arquivo */
  readonly version: string;
  readonly cards: readonly Card[];
};

export type DeckDiff = {
  readonly added: readonly CardId[];
  readonly removed: readonly CardId[];
  readonly edited: readonly CardId[];
};

/** IMP-07: falha de deck tem tipo próprio, e `app` mostra o motivo em vez de abrir sessão. */
export class DeckError extends Error {
  override readonly name = "DeckError";
}

const CAMPOS = ["id", "hanzi", "pinyin", "gloss"] as const;

/**
 * A-2: `id` único e estável. Um deck com id repetido é recusado aqui, e não
 * descoberto depois quando dois cartões disputarem o mesmo progresso.
 */
export function parse(json: unknown): Deck {
  if (!Array.isArray(json)) throw new DeckError("o deck precisa ser um array (§5)");
  if (json.length === 0) throw new DeckError("o deck está vazio");

  const cards: Card[] = [];
  const vistos = new Set<CardId>();

  for (const [i, bruto] of json.entries()) {
    if (typeof bruto !== "object" || bruto === null) {
      throw new DeckError(`cartão ${i} não é um objeto`);
    }
    const registro = bruto as Record<string, unknown>;
    for (const campo of CAMPOS) {
      const valor = registro[campo];
      if (typeof valor !== "string" || valor.length === 0) {
        throw new DeckError(`cartão ${i}: campo "${campo}" ausente ou vazio (§5)`);
      }
    }
    const id = registro["id"] as CardId;
    if (vistos.has(id)) throw new DeckError(`id repetido no deck: "${id}" (viola A-2)`);
    vistos.add(id);
    cards.push({
      id,
      hanzi: registro["hanzi"] as string,
      pinyin: registro["pinyin"] as string,
      gloss: registro["gloss"] as string,
    });
  }

  return { version: versionOfCards(cards), cards };
}

/**
 * Forma canônica: `id|hanzi|pinyin|gloss` por cartão, na ordem do arquivo, unidos por "\n".
 * É sobre ela que o hash roda — NÃO sobre os bytes do arquivo. É isso que torna a versão
 * insensível a indentação e a espaçamento (fecha MIG-03 e MEC-03).
 */
export function canonicalForm(cards: readonly Card[]): string {
  return cards.map((c) => `${c.id}|${c.hanzi}|${c.pinyin}|${c.gloss}`).join("\n");
}

/** FNV-1a de 32 bits. Fonte e constantes em specs/references/fnv-1a.md (fecha SCI-03). */
const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

export function fnv1a32(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let hash = FNV_OFFSET_BASIS;
  for (const b of bytes) {
    hash ^= b;                       // FNV-1a: XOR ANTES da multiplicação
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function versionOfCards(cards: readonly Card[]): string {
  return fnv1a32(canonicalForm(cards));
}

/** Síncrona de propósito: IMP-01 rejeitou `crypto.subtle`, que é assíncrona. */
export function versionOf(deck: Deck): string {
  return versionOfCards(deck.cards);
}

export function activeCardIds(deck: Deck): Set<CardId> {
  return new Set(deck.cards.map((c) => c.id));
}

export function cardById(deck: Deck, id: CardId): Card | null {
  return deck.cards.find((c) => c.id === id) ?? null;
}

/**
 * Diferença entre versões do deck. Não move progresso nenhum — o progresso é
 * indexado por `id` e vive no log. Serve para explicar a migração, não para executá-la.
 */
export function diff(prev: Deck, next: Deck): DeckDiff {
  const antes = new Map(prev.cards.map((c) => [c.id, c] as const));
  const depois = new Map(next.cards.map((c) => [c.id, c] as const));

  const added: CardId[] = [];
  const removed: CardId[] = [];
  const edited: CardId[] = [];

  for (const [id, c] of depois) {
    const anterior = antes.get(id);
    if (!anterior) added.push(id);
    else if (anterior.hanzi !== c.hanzi || anterior.pinyin !== c.pinyin || anterior.gloss !== c.gloss) {
      edited.push(id);
    }
  }
  for (const id of antes.keys()) if (!depois.has(id)) removed.push(id);

  return { added, removed, edited };
}
