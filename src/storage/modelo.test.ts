import { describe, expect, it } from 'vitest';
import { carregarDeck } from '../deck/index.js';
import { estadoInicial } from '../scheduler/index.js';
import {
  ErroModeloIncompativel,
  VERSAO_MODELO,
  aplicarMigracoes,
  parseEstadoPersistido,
} from './index.js';
import type { Migracao } from './index.js';

const deck = carregarDeck('exemplo');

const registroValido = {
  versaoModelo: VERSAO_MODELO,
  deck: { id: deck.id, versao: deck.versao, cartoes: deck.cartoes },
  progresso: [estadoInicial('c001')],
  orfaos: [],
  atualizadoEm: 123,
};

describe('aplicarMigracoes', () => {
  it('deixa passar um registro já na versão corrente', () => {
    expect(aplicarMigracoes(registroValido)['versaoModelo']).toBe(VERSAO_MODELO);
  });

  it('recusa registro de uma versão mais nova que a suportada', () => {
    expect(() => aplicarMigracoes({ ...registroValido, versaoModelo: VERSAO_MODELO + 1 })).toThrow(
      /mais nova que a suportada/,
    );
  });

  it('recusa registro sem versão de modelo', () => {
    expect(() => aplicarMigracoes({ progresso: [] })).toThrow(ErroModeloIncompativel);
  });

  it('recusa registro que não é objeto', () => {
    expect(() => aplicarMigracoes([1, 2, 3])).toThrow(ErroModeloIncompativel);
    expect(() => aplicarMigracoes('texto')).toThrow(ErroModeloIncompativel);
  });

  it('encadeia as migrações registradas, uma versão por vez', () => {
    const passos: number[] = [];
    const migracoes = new Map<number, Migracao>([
      [1, (r) => { passos.push(1); return { ...r, a: true }; }],
      [2, (r) => { passos.push(2); return { ...r, b: true }; }],
    ]);

    const resultado = aplicarMigracoes({ versaoModelo: 1 }, migracoes, 3);

    expect(passos).toEqual([1, 2]);
    expect(resultado).toEqual({ versaoModelo: 3, a: true, b: true });
  });

  it('falha alto quando falta um degrau da cadeia', () => {
    const migracoes = new Map<number, Migracao>([[2, (r) => r]]);
    expect(() => aplicarMigracoes({ versaoModelo: 1 }, migracoes, 3)).toThrow(
      /sem migração do modelo 1 para 2/,
    );
  });
});

describe('parseEstadoPersistido', () => {
  it('lê um registro bem formado', () => {
    const estado = parseEstadoPersistido(registroValido);
    expect(estado.deck.versao).toBe(deck.versao);
    expect(estado.progresso).toEqual([estadoInicial('c001')]);
    expect(estado.atualizadoEm).toBe(123);
  });

  it('aceita registro sem a lista de órfãos', () => {
    const { orfaos: _, ...semOrfaos } = registroValido;
    expect(parseEstadoPersistido(semOrfaos).orfaos).toEqual([]);
  });

  it('recusa registro sem deck identificado', () => {
    expect(() => parseEstadoPersistido({ ...registroValido, deck: { id: 'x' } })).toThrow(
      /deck identificado/,
    );
  });

  it('recusa estado de cartão com campo inválido', () => {
    const ruim = { ...registroValido, progresso: [{ ...estadoInicial('c001'), ef: 'muito' }] };
    expect(() => parseEstadoPersistido(ruim)).toThrow(/ef/);
  });

  it('recusa proximaRevisao que não seja número nem null', () => {
    const ruim = {
      ...registroValido,
      progresso: [{ ...estadoInicial('c001'), proximaRevisao: 'amanhã' }],
    };
    expect(() => parseEstadoPersistido(ruim)).toThrow(/proximaRevisao/);
  });

  it('aceita proximaRevisao nula', () => {
    expect(parseEstadoPersistido(registroValido).progresso[0]?.proximaRevisao).toBeNull();
  });
});
