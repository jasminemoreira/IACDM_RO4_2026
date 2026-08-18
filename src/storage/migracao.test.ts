import { describe, expect, it } from 'vitest';
import { carregarDeck } from '../deck/index.js';
import type { DeckIdentificado } from '../deck/index.js';
import { MS_POR_DIA, estadoInicial, revisar } from '../scheduler/index.js';
import type { EstadoCartao } from '../scheduler/index.js';
import { VERSAO_MODELO, migrarParaDeck } from './index.js';
import type { EstadoPersistido } from './index.js';

const T0 = Date.UTC(2026, 0, 1);
const v1 = carregarDeck('exemplo');
const v2 = carregarDeck('exemplo-v2');

/** Um estado persistido no deck `deck`, com os cartões de `revisados` já estudados. */
function persistido(deck: DeckIdentificado, revisados: readonly string[] = []): EstadoPersistido {
  return {
    versaoModelo: VERSAO_MODELO,
    deck: { id: deck.id, versao: deck.versao, cartoes: deck.cartoes },
    progresso: deck.cartoes.map((c) =>
      revisados.includes(c.id) ? revisar(estadoInicial(c.id), 5, T0) : estadoInicial(c.id),
    ),
    orfaos: [],
    atualizadoEm: T0,
  };
}

const estadoDe = (e: EstadoPersistido, id: string): EstadoCartao | undefined =>
  e.progresso.find((p) => p.cartaoId === id);
const orfaoDe = (e: EstadoPersistido, id: string): EstadoCartao | undefined =>
  e.orfaos.find((p) => p.cartaoId === id);

describe('primeira abertura', () => {
  it('cria progresso zerado para todo o deck', () => {
    const { estado, relatorio } = migrarParaDeck(null, v1, T0);

    expect(estado.progresso).toHaveLength(12);
    expect(estado.progresso.every((e) => e.n === 0 && e.proximaRevisao === null)).toBe(true);
    expect(estado.deck.versao).toBe(v1.versao);
    expect(relatorio.houveTroca).toBe(false);
    expect(relatorio.novos).toHaveLength(12);
  });
});

describe('mesma versão do deck', () => {
  it('devolve o estado guardado sem tocar em nada', () => {
    const anterior = persistido(v1, ['c001']);
    const { estado, relatorio } = migrarParaDeck(anterior, v1, T0 + MS_POR_DIA);

    expect(estado).toBe(anterior);
    expect(relatorio.houveTroca).toBe(false);
    expect(relatorio.arquivados).toEqual([]);
  });
});

describe('troca de versão do deck', () => {
  it('mantém o progresso dos cartões que continuam no deck', () => {
    const anterior = persistido(v1, ['c001', 'c002', 'c012']);
    const { estado, relatorio } = migrarParaDeck(anterior, v2, T0 + MS_POR_DIA);

    expect(relatorio.houveTroca).toBe(true);
    expect(relatorio.deVersao).toBe(v1.versao);
    expect(relatorio.paraVersao).toBe(v2.versao);

    for (const id of ['c001', 'c002', 'c012']) {
      expect(estadoDe(estado, id)).toEqual(estadoDe(anterior, id));
      expect(estadoDe(estado, id)?.n).toBe(1);
    }
    expect(relatorio.mantidos).toHaveLength(11);
  });

  it('mantém o progresso mesmo quando o texto do cartão mudou', () => {
    // c003 tem gloss diferente na v2, mas o mesmo id: é o mesmo cartão.
    const anterior = persistido(v1, ['c003']);
    const { estado } = migrarParaDeck(anterior, v2, T0);

    expect(estadoDe(estado, 'c003')?.n).toBe(1);
    expect(estado.deck.cartoes.find((c) => c.id === 'c003')?.gloss).toBe('goodbye, see you again');
  });

  it('dá estado inicial aos cartões novos', () => {
    const { estado, relatorio } = migrarParaDeck(persistido(v1), v2, T0);

    expect(relatorio.novos).toEqual(['c013', 'c014']);
    expect(estadoDe(estado, 'c013')).toEqual(estadoInicial('c013'));
  });

  it('arquiva, sem apagar, o progresso do cartão que saiu do deck', () => {
    const anterior = persistido(v1, ['c011']);
    const revisaoDeC011 = estadoDe(anterior, 'c011');
    const { estado, relatorio } = migrarParaDeck(anterior, v2, T0);

    expect(relatorio.arquivados).toEqual(['c011']);
    expect(estadoDe(estado, 'c011')).toBeUndefined();
    expect(orfaoDe(estado, 'c011')).toEqual(revisaoDeC011);
  });

  it('restaura o progresso do cartão arquivado que volta ao deck', () => {
    const inicial = persistido(v1, ['c011']);
    const original = estadoDe(inicial, 'c011');

    const naV2 = migrarParaDeck(inicial, v2, T0).estado;
    const devolta = migrarParaDeck(naV2, v1, T0 + MS_POR_DIA);

    expect(devolta.relatorio.restaurados).toEqual(['c011']);
    expect(estadoDe(devolta.estado, 'c011')).toEqual(original);
    // c011 saiu dos órfãos; quem agora está fora do deck é o par exclusivo da v2
    expect(orfaoDe(devolta.estado, 'c011')).toBeUndefined();
    expect(devolta.estado.orfaos.map((e) => e.cartaoId)).toEqual(['c013', 'c014']);
  });

  it('nenhuma revisão registrada se perde na ida e na volta', () => {
    const inicial = persistido(v1, v1.cartoes.map((c) => c.id));
    const antes = new Map(inicial.progresso.map((e) => [e.cartaoId, e]));

    const naV2 = migrarParaDeck(inicial, v2, T0).estado;
    const devolta = migrarParaDeck(naV2, v1, T0).estado;

    // toda revisão do estado original continua presente, byte a byte
    for (const [id, estado] of antes) {
      const guardado = estadoDe(devolta, id) ?? orfaoDe(devolta, id);
      expect(guardado).toEqual(estado);
    }
    expect(devolta.progresso).toHaveLength(12);
  });

  it('não duplica órfãos ao trocar de versão duas vezes', () => {
    const inicial = persistido(v1, ['c011']);
    const uma = migrarParaDeck(inicial, v2, T0).estado;
    const outra = migrarParaDeck(uma, { ...v2, versao: `${v2.versao}-x` }, T0).estado;

    expect(outra.orfaos.filter((e) => e.cartaoId === 'c011')).toHaveLength(1);
  });
});
