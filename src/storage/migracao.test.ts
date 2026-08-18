import { describe, expect, it } from 'vitest';
import { carregarDeck } from '../deck/index.js';
import type { DeckIdentificado } from '../deck/index.js';
import { MS_POR_DIA } from '../scheduler/index.js';
import { novaRevisao } from '../sync/index.js';
import type { Revisao } from '../sync/index.js';
import { VERSAO_MODELO, migrarParaDeck } from './index.js';
import type { EstadoPersistido } from './index.js';
import { progressoDe } from './repositorio.js';

const T0 = Date.UTC(2026, 0, 1);
const v1 = carregarDeck('exemplo');
const v2 = carregarDeck('exemplo-v2');

/** Um registro no deck `deck`, com uma revisão nota 5 para cada id em `revisados`. */
function persistido(deck: DeckIdentificado, revisados: readonly string[] = []): EstadoPersistido {
  const log: Revisao[] = [];
  revisados.forEach((cartaoId, i) => {
    log.push(novaRevisao(log, 'disp', cartaoId, 5, T0 + i));
  });
  return {
    versaoModelo: VERSAO_MODELO,
    deck: { id: deck.id, versao: deck.versao, cartoes: deck.cartoes },
    base: [],
    log,
    atualizadoEm: T0,
  };
}

describe('primeira abertura', () => {
  it('cria um registro vazio: nenhum fato, todo o deck devido', () => {
    const { estado, relatorio } = migrarParaDeck(null, v1, T0);

    expect(estado.log).toEqual([]);
    expect(estado.base).toEqual([]);
    expect(estado.deck.versao).toBe(v1.versao);
    expect(relatorio.houveTroca).toBe(false);
    expect(relatorio.novos).toHaveLength(12);

    const progresso = progressoDe(estado);
    expect([...progresso.values()].every((e) => e.n === 0 && e.proximaRevisao === null)).toBe(true);
  });
});

describe('mesma versão do deck', () => {
  it('devolve o registro guardado sem tocar em nada', () => {
    const anterior = persistido(v1, ['c001']);
    const { estado, relatorio } = migrarParaDeck(anterior, v1, T0 + MS_POR_DIA);

    expect(estado).toBe(anterior);
    expect(relatorio.houveTroca).toBe(false);
    expect(relatorio.mantidos).toEqual(['c001']);
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
    expect(relatorio.mantidos).toEqual(['c001', 'c002', 'c012']);

    const antes = progressoDe(anterior);
    const depois = progressoDe(estado);
    for (const id of ['c001', 'c002', 'c012']) {
      expect(depois.get(id)).toEqual(antes.get(id));
      expect(depois.get(id)?.n).toBe(1);
    }
  });

  it('mantém o progresso mesmo quando o texto do cartão mudou', () => {
    // c003 tem gloss diferente na v2, mas o mesmo id: é o mesmo cartão.
    const { estado } = migrarParaDeck(persistido(v1, ['c003']), v2, T0);

    expect(progressoDe(estado).get('c003')?.n).toBe(1);
    expect(estado.deck.cartoes.find((c) => c.id === 'c003')?.gloss).toBe('goodbye, see you again');
  });

  it('dá estado inicial aos cartões novos', () => {
    const { estado, relatorio } = migrarParaDeck(persistido(v1), v2, T0);

    expect(relatorio.novos).toEqual(expect.arrayContaining(['c013', 'c014']));
    expect(progressoDe(estado).get('c013')?.proximaRevisao).toBeNull();
  });

  it('o cartão que sai do deck não é projetado, mas suas revisões ficam no log', () => {
    const anterior = persistido(v1, ['c011']);
    const { estado, relatorio } = migrarParaDeck(anterior, v2, T0);

    expect(relatorio.arquivados).toEqual(['c011']);
    expect(progressoDe(estado).has('c011')).toBe(false);
    expect(estado.log.filter((r) => r.cartaoId === 'c011')).toEqual(
      anterior.log.filter((r) => r.cartaoId === 'c011'),
    );
  });

  it('o cartão que volta ao deck reaparece com todo o histórico aplicado', () => {
    const inicial = persistido(v1, ['c011']);
    const original = progressoDe(inicial).get('c011');

    const naV2 = migrarParaDeck(inicial, v2, T0).estado;
    const devolta = migrarParaDeck(naV2, v1, T0 + MS_POR_DIA);

    expect(devolta.relatorio.restaurados).toEqual(['c011']);
    expect(progressoDe(devolta.estado).get('c011')).toEqual(original);
  });

  it('nenhuma revisão registrada se perde na ida e na volta', () => {
    const inicial = persistido(v1, v1.cartoes.map((c) => c.id));

    const naV2 = migrarParaDeck(inicial, v2, T0).estado;
    const devolta = migrarParaDeck(naV2, v1, T0).estado;

    expect(devolta.log).toEqual(inicial.log);
    expect(progressoDe(devolta)).toEqual(progressoDe(inicial));
  });

  it('não duplica nada ao trocar de versão duas vezes', () => {
    const inicial = persistido(v1, ['c011']);
    const uma = migrarParaDeck(inicial, v2, T0).estado;
    const outra = migrarParaDeck(uma, { ...v2, versao: `${v2.versao}-x` }, T0).estado;

    expect(outra.log).toEqual(inicial.log);
  });
});
