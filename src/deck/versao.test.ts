import { describe, expect, it } from 'vitest';
import { DECK_PADRAO, carregarDeck, idsDeDecks, parseDeck, versaoDoDeck } from './index.js';

const base = [
  { id: 'c001', hanzi: '你好', pinyin: 'nǐ hǎo', gloss: 'hello' },
  { id: 'c002', hanzi: '谢谢', pinyin: 'xiè xie', gloss: 'thank you' },
];

describe('versaoDoDeck', () => {
  it('é estável para o mesmo conteúdo', () => {
    expect(versaoDoDeck(parseDeck(base))).toBe(versaoDoDeck(parseDeck(structuredClone(base))));
  });

  it('muda quando um campo de um cartão muda', () => {
    const editado = structuredClone(base);
    editado[0]!.gloss = 'hi';
    expect(versaoDoDeck(parseDeck(editado))).not.toBe(versaoDoDeck(parseDeck(base)));
  });

  it('muda quando um cartão entra ou sai', () => {
    const comMais = [...base, { id: 'c003', hanzi: '火', pinyin: 'huǒ', gloss: 'fire' }];
    const comMenos = [base[0]!];
    const v = versaoDoDeck(parseDeck(base));
    expect(versaoDoDeck(parseDeck(comMais))).not.toBe(v);
    expect(versaoDoDeck(parseDeck(comMenos))).not.toBe(v);
  });
});

describe('catálogo de decks', () => {
  it('expõe os decks de entrada disponíveis', () => {
    expect(idsDeDecks()).toEqual(['exemplo', 'exemplo-v2']);
  });

  it('carrega e valida o deck padrão', () => {
    const deck = carregarDeck();
    expect(deck.id).toBe(DECK_PADRAO);
    expect(deck.cartoes).toHaveLength(12);
    expect(deck.versao).toMatch(/^12-[0-9a-f]{8}$/);
  });

  it('as duas versões do deck têm versões distintas', () => {
    expect(carregarDeck('exemplo').versao).not.toBe(carregarDeck('exemplo-v2').versao);
  });

  it('a v2 remove c011 e acrescenta c013 e c014', () => {
    const ids = carregarDeck('exemplo-v2').cartoes.map((c) => c.id);
    expect(ids).not.toContain('c011');
    expect(ids).toEqual(expect.arrayContaining(['c013', 'c014']));
  });

  it('cai no deck padrão para id desconhecido', () => {
    expect(carregarDeck('nao-existe').id).toBe(DECK_PADRAO);
  });
});
