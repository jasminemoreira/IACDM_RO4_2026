import brutoV1 from '../../decks/exemplo.json';
import brutoV2 from '../../decks/exemplo-v2.json';
import type { Deck } from './tipos.js';
import { parseDeck } from './parse.js';
import { versaoDoDeck } from './versao.js';

/** Um deck de entrada já validado, com identidade e versão. */
export interface DeckIdentificado {
  readonly id: string;
  readonly rotulo: string;
  readonly versao: string;
  readonly cartoes: Deck;
}

/**
 * Os decks de entrada disponíveis. São conteúdo fixo fornecido à aplicação;
 * o catálogo apenas os nomeia — nada aqui cria ou edita cartões.
 */
const ENTRADAS: ReadonlyArray<{ id: string; rotulo: string; bruto: unknown }> = [
  { id: 'exemplo', rotulo: 'HSK básico', bruto: brutoV1 },
  { id: 'exemplo-v2', rotulo: 'HSK básico revisado', bruto: brutoV2 },
];

export const DECK_PADRAO = 'exemplo';

export function idsDeDecks(): readonly string[] {
  return ENTRADAS.map((e) => e.id);
}

/** Valida e identifica um deck do catálogo. Cai no padrão se o id não existir. */
export function carregarDeck(id: string = DECK_PADRAO): DeckIdentificado {
  const entrada = ENTRADAS.find((e) => e.id === id) ?? ENTRADAS[0];
  if (entrada === undefined) throw new Error('catálogo de decks vazio');
  const cartoes: Deck = parseDeck(entrada.bruto);
  return {
    id: entrada.id,
    rotulo: entrada.rotulo,
    versao: versaoDoDeck(cartoes),
    cartoes,
  };
}
