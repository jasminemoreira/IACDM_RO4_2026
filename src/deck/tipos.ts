/** Um cartão de vocabulário, exatamente no formato da §5 do brief. */
export interface Cartao {
  readonly id: string;
  readonly hanzi: string;
  readonly pinyin: string;
  readonly gloss: string;
}

/** Deck fixo, fornecido como entrada. A aplicação nunca o modifica. */
export type Deck = readonly Cartao[];
