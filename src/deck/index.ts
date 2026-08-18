/** Ponto de entrada do módulo `deck`: formato do conteúdo, validação e catálogo. */
export type { Cartao, Deck } from './tipos.js';
export { parseDeck, cartaoPorId, ErroFormatoDeck } from './parse.js';
export { versaoDoDeck } from './versao.js';
export type { DeckIdentificado } from './catalogo.js';
export { DECK_PADRAO, carregarDeck, catalogoDeDecks, idsDeDecks } from './catalogo.js';
