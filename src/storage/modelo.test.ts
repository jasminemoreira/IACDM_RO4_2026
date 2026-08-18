import { describe, expect, it } from 'vitest';
import { carregarDeck } from '../deck/index.js';
import { estadoInicial, revisar } from '../scheduler/index.js';
import {
  ErroModeloIncompativel,
  MIGRACOES,
  VERSAO_MODELO,
  aplicarMigracoes,
  parseEstadoPersistido,
} from './index.js';
import type { Migracao } from './index.js';
import { progressoDe } from './repositorio.js';

const T0 = Date.UTC(2026, 0, 1);
const deck = carregarDeck('exemplo');
const deckPersistido = { id: deck.id, versao: deck.versao, cartoes: deck.cartoes };

const registroValido = {
  versaoModelo: VERSAO_MODELO,
  deck: deckPersistido,
  base: [],
  log: [{ id: 'a-1', dispositivo: 'a', cartaoId: 'c001', q: 5, em: T0 }],
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
    expect(() => aplicarMigracoes({ log: [] })).toThrow(ErroModeloIncompativel);
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

describe('migração do modelo 1 para o 2', () => {
  const revisadoNaV1 = revisar(estadoInicial('c001'), 5, T0);
  const orfaoNaV1 = revisar(estadoInicial('c011'), 4, T0);

  const registroV1 = {
    versaoModelo: 1,
    deck: deckPersistido,
    progresso: [revisadoNaV1, estadoInicial('c002')],
    orfaos: [orfaoNaV1],
    atualizadoEm: 99,
  };

  it('está registrada na cadeia', () => {
    expect(MIGRACOES.has(1)).toBe(true);
  });

  it('vira estado herdado, com log vazio', () => {
    const estado = parseEstadoPersistido(registroV1);

    expect(estado.versaoModelo).toBe(2);
    expect(estado.log).toEqual([]);
    expect(estado.base).toEqual([revisadoNaV1, estadoInicial('c002'), orfaoNaV1]);
  });

  it('não perde o progresso de nenhum cartão, nem o dos órfãos', () => {
    const estado = parseEstadoPersistido(registroV1);
    const progresso = progressoDe(estado);

    expect(progresso.get('c001')).toEqual(revisadoNaV1);
    expect(estado.base.find((e) => e.cartaoId === 'c011')).toEqual(orfaoNaV1);
  });

  it('o campo antigo não sobrevive à migração', () => {
    const migrado = aplicarMigracoes(registroV1);
    expect(migrado['progresso']).toBeUndefined();
    expect(migrado['orfaos']).toBeUndefined();
  });

  it('aceita registro da versão 1 sem órfãos', () => {
    const { orfaos: _, ...semOrfaos } = registroV1;
    expect(parseEstadoPersistido(semOrfaos).base).toHaveLength(2);
  });
});

describe('parseEstadoPersistido', () => {
  it('lê um registro bem formado', () => {
    const estado = parseEstadoPersistido(registroValido);
    expect(estado.deck.versao).toBe(deck.versao);
    expect(estado.log.map((r) => r.id)).toEqual(['a-1']);
    expect(estado.atualizadoEm).toBe(123);
  });

  it('aceita registro sem log e sem base', () => {
    const estado = parseEstadoPersistido({ versaoModelo: 2, deck: deckPersistido });
    expect(estado.log).toEqual([]);
    expect(estado.base).toEqual([]);
  });

  it('recusa registro sem deck identificado', () => {
    expect(() => parseEstadoPersistido({ ...registroValido, deck: { id: 'x' } })).toThrow(
      /deck identificado/,
    );
  });

  it('recusa estado herdado com campo inválido', () => {
    const ruim = { ...registroValido, base: [{ ...estadoInicial('c001'), ef: 'muito' }] };
    expect(() => parseEstadoPersistido(ruim)).toThrow(/ef/);
  });

  it('recusa revisão malformada no log', () => {
    const ruim = {
      ...registroValido,
      log: [{ id: 'a-1', dispositivo: 'a', cartaoId: 'c001', q: 9, em: T0 }],
    };
    expect(() => parseEstadoPersistido(ruim)).toThrow(/0\.\.5/);
  });

  it('ordena o log na leitura', () => {
    const foraDeOrdem = {
      ...registroValido,
      log: [
        { id: 'a-2', dispositivo: 'a', cartaoId: 'c001', q: 5, em: T0 + 10 },
        { id: 'a-1', dispositivo: 'a', cartaoId: 'c001', q: 4, em: T0 },
      ],
    };
    expect(parseEstadoPersistido(foraDeOrdem).log.map((r) => r.id)).toEqual(['a-1', 'a-2']);
  });
});
