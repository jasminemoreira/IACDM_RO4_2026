import { describe, expect, it } from 'vitest';
import { ErroFormatoDeck, cartaoPorId, parseDeck } from './index.js';
import exemplo from '../../decks/exemplo.json';

describe('parseDeck', () => {
  it('aceita o deck de exemplo fornecido como entrada', () => {
    const deck = parseDeck(exemplo);
    expect(deck).toHaveLength(12);
    expect(deck[0]).toEqual({
      id: 'c001',
      hanzi: '你好',
      pinyin: 'nǐ hǎo',
      gloss: 'hello',
    });
  });

  it('rejeita entrada que não seja array', () => {
    expect(() => parseDeck({ id: 'c001' })).toThrow(ErroFormatoDeck);
  });

  it('rejeita deck vazio', () => {
    expect(() => parseDeck([])).toThrow(/vazio/);
  });

  it('rejeita cartão sem campo obrigatório', () => {
    const semGloss = [{ id: 'c001', hanzi: '你好', pinyin: 'nǐ hǎo' }];
    expect(() => parseDeck(semGloss)).toThrow(/gloss/);
  });

  it('rejeita campo em branco', () => {
    const vazio = [{ id: 'c001', hanzi: '  ', pinyin: 'nǐ hǎo', gloss: 'hello' }];
    expect(() => parseDeck(vazio)).toThrow(/hanzi/);
  });

  it('rejeita ids duplicados', () => {
    const dup = [
      { id: 'c001', hanzi: '你', pinyin: 'nǐ', gloss: 'you' },
      { id: 'c001', hanzi: '我', pinyin: 'wǒ', gloss: 'me' },
    ];
    expect(() => parseDeck(dup)).toThrow(/duplicado/);
  });
});

describe('cartaoPorId', () => {
  it('encontra o cartão e devolve undefined para id desconhecido', () => {
    const deck = parseDeck(exemplo);
    expect(cartaoPorId(deck, 'c003')?.gloss).toBe('goodbye');
    expect(cartaoPorId(deck, 'nao-existe')).toBeUndefined();
  });
});
