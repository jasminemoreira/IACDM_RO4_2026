import { describe, expect, it } from 'vitest';
import { carregarDeck } from '../deck/index.js';
import { estadoInicial, revisar } from '../scheduler/index.js';
import { iniciarSessao, progressoInicial, responder } from '../session/index.js';
import {
  ErroRevisaoInvalida,
  novaRevisao,
  ordenar,
  parseLog,
  projetar,
  unir,
} from './index.js';
import type { Revisao } from './index.js';

const T0 = Date.UTC(2026, 0, 1);
const deck = carregarDeck('exemplo');

const rev = (id: string, cartaoId: string, q: 0 | 1 | 2 | 3 | 4 | 5, em: number): Revisao => ({
  id,
  dispositivo: id.split('-')[0] ?? 'd',
  cartaoId,
  q,
  em,
});

describe('ordenar', () => {
  it('ordena por instante', () => {
    const log = [rev('a-2', 'c001', 5, T0 + 10), rev('a-1', 'c001', 4, T0)];
    expect(ordenar(log).map((r) => r.id)).toEqual(['a-1', 'a-2']);
  });

  it('desempata por id quando o instante é o mesmo', () => {
    const log = [rev('b-1', 'c001', 5, T0), rev('a-1', 'c001', 4, T0)];
    expect(ordenar(log).map((r) => r.id)).toEqual(['a-1', 'b-1']);
  });

  it('não muta a lista recebida', () => {
    const log = [rev('b-1', 'c001', 5, T0 + 5), rev('a-1', 'c001', 4, T0)];
    ordenar(log);
    expect(log.map((r) => r.id)).toEqual(['b-1', 'a-1']);
  });
});

describe('unir', () => {
  const a = [rev('a-1', 'c001', 5, T0), rev('a-2', 'c002', 4, T0 + 10)];
  const b = [rev('b-1', 'c001', 3, T0 + 5)];

  it('mantém as revisões dos dois lados', () => {
    expect(unir(a, b).map((r) => r.id)).toEqual(['a-1', 'b-1', 'a-2']);
  });

  it('é comutativa', () => {
    expect(unir(a, b)).toEqual(unir(b, a));
  });

  it('é idempotente: sincronizar de novo não muda nada', () => {
    const uma = unir(a, b);
    expect(unir(uma, uma)).toEqual(uma);
    expect(unir(uma, b)).toEqual(uma);
  });

  it('é associativa', () => {
    const c = [rev('c-1', 'c003', 5, T0 + 1)];
    expect(unir(unir(a, b), c)).toEqual(unir(a, unir(b, c)));
  });

  it('não duplica o fato que os dois lados já conhecem', () => {
    expect(unir(a, a.slice(0, 1))).toHaveLength(2);
  });
});

describe('novaRevisao', () => {
  it('numera a partir do que o dispositivo já tem no log', () => {
    const log = [rev('a-1', 'c001', 5, T0), rev('b-1', 'c002', 5, T0)];
    expect(novaRevisao(log, 'a', 'c003', 4, T0 + 1).id).toBe('a-2');
    expect(novaRevisao(log, 'b', 'c003', 4, T0 + 1).id).toBe('b-2');
    expect(novaRevisao(log, 'c', 'c003', 4, T0 + 1).id).toBe('c-1');
  });

  it('não colide depois de uma união que trouxe revisões do próprio dispositivo', () => {
    const local = [rev('a-1', 'c001', 5, T0)];
    const remoto = [rev('a-2', 'c002', 5, T0 + 1), rev('a-3', 'c003', 5, T0 + 2)];
    expect(novaRevisao(unir(local, remoto), 'a', 'c004', 4, T0 + 3).id).toBe('a-4');
  });
});

describe('parseLog', () => {
  it('lê e ordena um log válido', () => {
    const bruto = [rev('a-2', 'c001', 5, T0 + 1), rev('a-1', 'c001', 4, T0)];
    expect(parseLog(bruto).map((r) => r.id)).toEqual(['a-1', 'a-2']);
  });

  it('recusa entrada que não é lista', () => {
    expect(() => parseLog({})).toThrow(ErroRevisaoInvalida);
  });

  it('recusa nota fora de 0..5', () => {
    expect(() => parseLog([{ ...rev('a-1', 'c001', 5, T0), q: 9 }])).toThrow(/0\.\.5/);
  });

  it('recusa revisão sem id', () => {
    const { id: _, ...semId } = rev('a-1', 'c001', 5, T0);
    expect(() => parseLog([semId])).toThrow(/"id"/);
  });

  it('recusa instante inválido', () => {
    expect(() => parseLog([{ ...rev('a-1', 'c001', 5, T0), em: 'ontem' }])).toThrow(/instante/);
  });
});

describe('projetar', () => {
  it('dobra o log sobre o estado inicial', () => {
    const log = [rev('a-1', 'c001', 5, T0), rev('a-2', 'c001', 5, T0 + 1)];
    const progresso = projetar([], log, deck.cartoes);

    const esperado = revisar(revisar(estadoInicial('c001'), 5, T0), 5, T0 + 1);
    expect(progresso.get('c001')).toEqual(esperado);
    expect(progresso.get('c002')).toEqual(estadoInicial('c002'));
  });

  it('parte de um estado herdado quando existe', () => {
    const herdado = revisar(estadoInicial('c001'), 5, T0);
    const progresso = projetar([herdado], [rev('a-1', 'c001', 5, T0 + 1)], deck.cartoes);

    expect(progresso.get('c001')).toEqual(revisar(herdado, 5, T0 + 1));
  });

  it('aplica na ordem total, não na ordem de chegada', () => {
    const cedo = rev('a-1', 'c001', 5, T0);
    const tarde = rev('b-1', 'c001', 0, T0 + 100);

    expect(projetar([], [cedo, tarde], deck.cartoes)).toEqual(
      projetar([], [tarde, cedo], deck.cartoes),
    );
  });

  it('ignora revisão de cartão fora do deck sem descartá-la do log', () => {
    const log = [rev('a-1', 'c999', 5, T0), rev('a-2', 'c001', 5, T0 + 1)];
    const progresso = projetar([], log, deck.cartoes);

    expect(progresso.has('c999')).toBe(false);
    expect(progresso.get('c001')?.n).toBe(1);
    expect(log).toHaveLength(2);
  });

  it('reproduz exatamente o progresso que a sessão calculou', () => {
    // invariante central: a dobra do log e o laço de revisão são a mesma conta
    const notas = [5, 3, 0, 4, 5] as const;
    let sessao = iniciarSessao(deck.cartoes, progressoInicial(deck.cartoes), T0);
    const log: Revisao[] = [];

    notas.forEach((q, i) => {
      const em = T0 + i;
      const cartaoId = sessao.fila[sessao.indice]!;
      log.push(novaRevisao(log, 'a', cartaoId, q, em));
      sessao = responder(sessao, q, em);
    });

    expect(projetar([], log, deck.cartoes)).toEqual(sessao.progresso);
  });
});
