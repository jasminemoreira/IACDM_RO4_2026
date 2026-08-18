/** Ponto de entrada do módulo `deck`: formato do conteúdo e sua validação. */
export type { Cartao, Deck } from './tipos.js';
export { parseDeck, cartaoPorId, ErroFormatoDeck } from './parse.js';
