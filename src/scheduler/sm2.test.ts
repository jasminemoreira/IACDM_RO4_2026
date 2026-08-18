import { describe, expect, it } from 'vitest';
import {
  EF_INICIAL,
  EF_MINIMO,
  ErroNotaInvalida,
  MS_POR_DIA,
  estadoInicial,
  revisar,
} from './index.js';
import type { EstadoCartao, Nota } from './index.js';

const T0 = Date.UTC(2026, 0, 1);

function revisarSequencia(notas: readonly Nota[], agora = T0): EstadoCartao {
  return notas.reduce((estado, q) => revisar(estado, q, agora), estadoInicial('c001'));
}

describe('estadoInicial', () => {
  it('começa com n = 0, EF = 2,5 e sem prazo', () => {
    expect(estadoInicial('c001')).toEqual({
      cartaoId: 'c001',
      n: 0,
      ef: EF_INICIAL,
      intervaloDias: 0,
      proximaRevisao: null,
    });
  });
});

describe('revisar — progressão de intervalos com q >= 3', () => {
  it('primeira repetição usa I = 1', () => {
    const e = revisar(estadoInicial('c001'), 5, T0);
    expect(e.n).toBe(1);
    expect(e.intervaloDias).toBe(1);
    expect(e.proximaRevisao).toBe(T0 + 1 * MS_POR_DIA);
  });

  it('segunda repetição usa I = 6', () => {
    const e = revisarSequencia([5, 5]);
    expect(e.n).toBe(2);
    expect(e.intervaloDias).toBe(6);
  });

  it('da terceira em diante usa round(I_anterior * EF_anterior)', () => {
    // após [5, 5]: I = 6, EF = 2,7. Terceira nota 4 mantém EF em 2,7.
    const anterior = revisarSequencia([5, 5]);
    expect(anterior.ef).toBeCloseTo(2.7, 10);

    const e = revisar(anterior, 4, T0);
    expect(e.intervaloDias).toBe(Math.round(6 * 2.7)); // 16
    expect(e.n).toBe(3);
    expect(e.ef).toBeCloseTo(2.7, 10);
  });

  it('encadeia a progressão 1, 6, 16, 43', () => {
    const intervalos: number[] = [];
    let e = estadoInicial('c001');
    for (const q of [5, 5, 4, 4] as const) {
      e = revisar(e, q, T0);
      intervalos.push(e.intervaloDias);
    }
    expect(intervalos).toEqual([1, 6, 16, Math.round(16 * 2.7)]);
  });
});

describe('revisar — atualização de EF', () => {
  it.each([
    [5, EF_INICIAL + 0.1],
    [4, EF_INICIAL + 0.0],
    [3, EF_INICIAL - 0.14],
    [2, EF_INICIAL - 0.32],
    [1, EF_INICIAL - 0.54],
    [0, EF_INICIAL - 0.8],
  ] as const)('nota %i move EF para %f', (q, esperado) => {
    expect(revisar(estadoInicial('c001'), q, T0).ef).toBeCloseTo(esperado, 10);
  });

  it('atualiza EF também no ramo de erro', () => {
    const e = revisar(estadoInicial('c001'), 1, T0);
    expect(e.ef).toBeCloseTo(EF_INICIAL - 0.54, 10);
  });

  it('nunca desce abaixo do piso de 1,3', () => {
    let e = estadoInicial('c001');
    for (let i = 0; i < 10; i += 1) e = revisar(e, 0, T0);
    expect(e.ef).toBe(EF_MINIMO);
  });
});

describe('revisar — ramo de erro (q < 3)', () => {
  it('zera n e volta o intervalo para 1 dia', () => {
    const maduro = revisarSequencia([5, 5, 5]);
    expect(maduro.n).toBe(3);

    const errou = revisar(maduro, 2, T0);
    expect(errou.n).toBe(0);
    expect(errou.intervaloDias).toBe(1);
    expect(errou.proximaRevisao).toBe(T0 + MS_POR_DIA);
  });

  it('após o erro a progressão recomeça em 1 e 6', () => {
    const errou = revisar(revisarSequencia([5, 5, 5]), 0, T0);
    const a = revisar(errou, 4, T0);
    const b = revisar(a, 4, T0);
    expect([a.intervaloDias, b.intervaloDias]).toEqual([1, 6]);
  });

  it('nota 3 conta como acerto e nota 2 como erro', () => {
    expect(revisar(estadoInicial('c001'), 3, T0).n).toBe(1);
    expect(revisar(estadoInicial('c001'), 2, T0).n).toBe(0);
  });
});

describe('revisar — contrato', () => {
  it('não muta o estado recebido', () => {
    const antes = estadoInicial('c001');
    const copia = { ...antes };
    revisar(antes, 5, T0);
    expect(antes).toEqual(copia);
  });

  it('preserva o id do cartão', () => {
    expect(revisar(estadoInicial('c042'), 5, T0).cartaoId).toBe('c042');
  });

  it('rejeita nota fora de 0..5', () => {
    expect(() => revisar(estadoInicial('c001'), 6 as Nota, T0)).toThrow(ErroNotaInvalida);
    expect(() => revisar(estadoInicial('c001'), -1 as Nota, T0)).toThrow(ErroNotaInvalida);
    expect(() => revisar(estadoInicial('c001'), 3.5 as Nota, T0)).toThrow(ErroNotaInvalida);
  });
});
