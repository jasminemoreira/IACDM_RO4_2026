import { describe, expect, it } from 'vitest';
import { parseDeck } from '../deck/index.js';
import type { Deck } from '../deck/index.js';
import { MS_POR_DIA } from '../scheduler/index.js';
import { progressoInicial } from '../session/index.js';
import type { EstadoApp } from './estado.js';
import { iniciar, reiniciar, responder, revelar, visaoDe } from './estado.js';

const T0 = Date.UTC(2026, 0, 1);

const deck: Deck = parseDeck([
  { id: 'c001', hanzi: '你好', pinyin: 'nǐ hǎo', gloss: 'hello' },
  { id: 'c002', hanzi: '谢谢', pinyin: 'xiè xie', gloss: 'thank you' },
]);

const novoEstado = (agora = T0): EstadoApp => iniciar(deck, progressoInicial(deck), agora);

describe('visaoDe', () => {
  it('mostra o primeiro cartão escondido', () => {
    const visao = visaoDe(novoEstado());
    expect(visao).toMatchObject({
      tipo: 'revisao',
      revelado: false,
      respondidos: 0,
      total: 2,
    });
  });

  it('revela a resposta sem trocar de cartão', () => {
    const revelada = visaoDe(revelar(novoEstado()));
    expect(revelada).toMatchObject({ tipo: 'revisao', revelado: true });
    if (revelada.tipo === 'revisao') expect(revelada.cartao.pinyin).toBe('nǐ hǎo');
  });

  it('esconde a resposta de novo ao avançar', () => {
    const proximo = responder(revelar(novoEstado()), 4, T0);
    const visao = visaoDe(proximo);
    expect(visao).toMatchObject({ tipo: 'revisao', revelado: false, respondidos: 1 });
    if (visao.tipo === 'revisao') expect(visao.cartao.id).toBe('c002');
  });

  it('mostra o resumo ao fim da sessão', () => {
    let estado = novoEstado();
    estado = responder(estado, 5, T0);
    estado = responder(estado, 3, T0);

    const visao = visaoDe(estado);
    expect(visao.tipo).toBe('fim');
    if (visao.tipo === 'fim') {
      expect(visao.respostas).toEqual([
        { cartaoId: 'c001', q: 5, intervaloDias: 1 },
        { cartaoId: 'c002', q: 3, intervaloDias: 1 },
      ]);
    }
  });

  it('avisa quando não há nada devido e informa o próximo prazo', () => {
    let estado = novoEstado();
    estado = responder(estado, 5, T0);
    estado = responder(estado, 5, T0);

    const visao = visaoDe(reiniciar(estado, T0));
    expect(visao).toEqual({ tipo: 'nada-devido', proximaRevisao: T0 + MS_POR_DIA });
  });
});

describe('reiniciar', () => {
  it('abre nova sessão preservando o progresso acumulado', () => {
    let estado = novoEstado();
    estado = responder(estado, 5, T0);
    estado = responder(estado, 5, T0);

    const amanha = reiniciar(estado, T0 + MS_POR_DIA);
    expect(amanha.sessao.fila).toEqual(['c001', 'c002']);
    expect(amanha.sessao.respostas).toEqual([]);
    expect(visaoDe(amanha)).toMatchObject({ tipo: 'revisao', respondidos: 0, total: 2 });
  });
});
