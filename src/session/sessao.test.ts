import { describe, expect, it } from 'vitest';
import { parseDeck } from '../deck/index.js';
import type { Deck } from '../deck/index.js';
import { MS_POR_DIA } from '../scheduler/index.js';
import type { Nota } from '../scheduler/index.js';
import {
  ErroSessaoConcluida,
  andamento,
  cartaoAtual,
  concluida,
  estadoDe,
  iniciarSessao,
  progressoInicial,
  responder,
} from './index.js';
import type { Sessao } from './index.js';

const T0 = Date.UTC(2026, 0, 1);

const deck: Deck = parseDeck([
  { id: 'c001', hanzi: '你好', pinyin: 'nǐ hǎo', gloss: 'hello' },
  { id: 'c002', hanzi: '谢谢', pinyin: 'xiè xie', gloss: 'thank you' },
  { id: 'c003', hanzi: '再见', pinyin: 'zài jiàn', gloss: 'goodbye' },
]);

/** Responde a sessão inteira com a mesma nota, do começo ao fim. */
function concluir(sessao: Sessao, q: Nota, agora = T0): Sessao {
  let atual = sessao;
  let passos = 0;
  while (!concluida(atual)) {
    atual = responder(atual, q, agora);
    passos += 1;
    if (passos > 100) throw new Error('a sessão não terminou');
  }
  return atual;
}

describe('iniciarSessao', () => {
  it('enfileira todos os cartões novos', () => {
    const sessao = iniciarSessao(deck, progressoInicial(deck), T0);
    expect(sessao.fila).toEqual(['c001', 'c002', 'c003']);
    expect(andamento(sessao)).toEqual({ respondidos: 0, total: 3 });
  });

  it('apresenta apenas os cartões devidos', () => {
    const primeira = concluir(iniciarSessao(deck, progressoInicial(deck), T0), 5);

    // logo depois, nada está devido: I = 1 dia para todos
    const mesmaHora = iniciarSessao(deck, primeira.progresso, T0);
    expect(mesmaHora.fila).toEqual([]);
    expect(concluida(mesmaHora)).toBe(true);

    // no dia seguinte, os três voltam
    const amanha = iniciarSessao(deck, primeira.progresso, T0 + MS_POR_DIA);
    expect(amanha.fila).toEqual(['c001', 'c002', 'c003']);
  });

  it('mistura cartões devidos e não devidos corretamente', () => {
    let progresso = progressoInicial(deck);
    let sessao = iniciarSessao(deck, progresso, T0);
    sessao = responder(sessao, 5, T0); // c001 -> devido em T0 + 1d
    sessao = responder(sessao, 5, T0); // c002 -> devido em T0 + 1d
    sessao = responder(sessao, 5, T0); // c003 -> devido em T0 + 1d
    progresso = sessao.progresso;

    // segunda rodada no dia seguinte, só c001 é respondido de novo
    let dia2 = iniciarSessao(deck, progresso, T0 + MS_POR_DIA);
    dia2 = responder(dia2, 5, T0 + MS_POR_DIA); // c001 -> I = 6 dias

    // dois dias depois: c002 e c003 estão atrasados, c001 não
    const dia3 = iniciarSessao(deck, dia2.progresso, T0 + 2 * MS_POR_DIA);
    expect(dia3.fila).toEqual(['c002', 'c003']);
  });
});

describe('cartaoAtual', () => {
  it('entrega o cartão da vez e null ao fim', () => {
    const sessao = iniciarSessao(deck, progressoInicial(deck), T0);
    expect(cartaoAtual(sessao)?.hanzi).toBe('你好');

    const depois = responder(sessao, 4, T0);
    expect(cartaoAtual(depois)?.hanzi).toBe('谢谢');

    expect(cartaoAtual(concluir(sessao, 4))).toBeNull();
  });
});

describe('responder', () => {
  it('recomputa o intervalo conforme a §4 e registra a resposta', () => {
    const sessao = responder(iniciarSessao(deck, progressoInicial(deck), T0), 5, T0);

    expect(sessao.respostas).toEqual([{ cartaoId: 'c001', q: 5, intervaloDias: 1 }]);
    const estado = estadoDe(sessao.progresso, 'c001');
    expect(estado.n).toBe(1);
    expect(estado.intervaloDias).toBe(1);
    expect(estado.ef).toBeCloseTo(2.6, 10);
    expect(estado.proximaRevisao).toBe(T0 + MS_POR_DIA);
  });

  it('não altera a sessão nem o progresso anteriores', () => {
    const antes = iniciarSessao(deck, progressoInicial(deck), T0);
    responder(antes, 0, T0);

    expect(antes.indice).toBe(0);
    expect(antes.respostas).toEqual([]);
    expect(estadoDe(antes.progresso, 'c001').proximaRevisao).toBeNull();
  });

  it('mantém o cartão errado fora da fila desta sessão e o reagenda para o dia seguinte', () => {
    const sessao = responder(iniciarSessao(deck, progressoInicial(deck), T0), 1, T0);

    expect(cartaoAtual(sessao)?.id).toBe('c002');
    expect(sessao.fila).toEqual(['c001', 'c002', 'c003']);
    expect(estadoDe(sessao.progresso, 'c001').proximaRevisao).toBe(T0 + MS_POR_DIA);
  });

  it('recusa nota depois do fim da sessão', () => {
    const fim = concluir(iniciarSessao(deck, progressoInicial(deck), T0), 4);
    expect(() => responder(fim, 4, T0)).toThrow(ErroSessaoConcluida);
  });
});

describe('sessão do início ao fim', () => {
  it('conclui percorrendo todos os cartões devidos', () => {
    const fim = concluir(iniciarSessao(deck, progressoInicial(deck), T0), 4);

    expect(concluida(fim)).toBe(true);
    expect(andamento(fim)).toEqual({ respondidos: 3, total: 3 });
    expect(fim.respostas.map((r) => r.cartaoId)).toEqual(['c001', 'c002', 'c003']);
    expect(cartaoAtual(fim)).toBeNull();
  });

  it('termina mesmo com todas as notas de erro', () => {
    const fim = concluir(iniciarSessao(deck, progressoInicial(deck), T0), 0);
    expect(concluida(fim)).toBe(true);
    expect(fim.respostas).toHaveLength(3);
  });

  it('uma sessão sem cartões devidos já nasce concluída', () => {
    const primeira = concluir(iniciarSessao(deck, progressoInicial(deck), T0), 5);
    const vazia = iniciarSessao(deck, primeira.progresso, T0);
    expect(concluida(vazia)).toBe(true);
    expect(andamento(vazia)).toEqual({ respondidos: 0, total: 0 });
  });
});
