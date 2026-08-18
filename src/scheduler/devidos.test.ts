import { describe, expect, it } from 'vitest';
import { MS_POR_DIA, estaDevido, estadoInicial, revisar, selecionarDevidos } from './index.js';

const T0 = Date.UTC(2026, 0, 1);
const ids = (estados: readonly { cartaoId: string }[]) => estados.map((e) => e.cartaoId);

describe('estaDevido', () => {
  it('cartão nunca revisado está devido', () => {
    expect(estaDevido(estadoInicial('c001'), T0)).toBe(true);
  });

  it('cartão revisado só volta a ficar devido no prazo', () => {
    const e = revisar(estadoInicial('c001'), 5, T0); // I = 1 dia
    expect(estaDevido(e, T0)).toBe(false);
    expect(estaDevido(e, T0 + MS_POR_DIA - 1)).toBe(false);
    expect(estaDevido(e, T0 + MS_POR_DIA)).toBe(true);
  });
});

describe('selecionarDevidos', () => {
  it('apresenta apenas os cartões devidos', () => {
    const novo = estadoInicial('c003');
    const agendadoAmanha = revisar(estadoInicial('c001'), 5, T0); // devido em T0 + 1d
    const agendadoEmSeis = revisar(revisar(estadoInicial('c002'), 5, T0), 5, T0); // T0 + 6d

    expect(ids(selecionarDevidos([agendadoAmanha, agendadoEmSeis, novo], T0))).toEqual(['c003']);
    expect(ids(selecionarDevidos([agendadoAmanha, agendadoEmSeis, novo], T0 + MS_POR_DIA)))
      .toEqual(['c003', 'c001']);
  });

  it('ordena nunca revisados primeiro, depois por prazo mais antigo', () => {
    const atrasado = revisar(estadoInicial('c001'), 5, T0 - 10 * MS_POR_DIA);
    const recente = revisar(estadoInicial('c002'), 5, T0 - 2 * MS_POR_DIA);
    const novo = estadoInicial('c003');

    expect(ids(selecionarDevidos([recente, atrasado, novo], T0)))
      .toEqual(['c003', 'c001', 'c002']);
  });

  it('desempata por id para ser determinístico', () => {
    const b = estadoInicial('c002');
    const a = estadoInicial('c001');
    expect(ids(selecionarDevidos([b, a], T0))).toEqual(['c001', 'c002']);
  });

  it('não muta nem reordena a lista recebida', () => {
    const entrada = [estadoInicial('c002'), estadoInicial('c001')];
    selecionarDevidos(entrada, T0);
    expect(ids(entrada)).toEqual(['c002', 'c001']);
  });
});
