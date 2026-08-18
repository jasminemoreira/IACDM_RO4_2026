import type { DeckIdentificado } from '../deck/index.js';
import type { Revisao } from '../sync/index.js';
import type { EstadoPersistido } from './modelo.js';
import { VERSAO_MODELO } from './modelo.js';

/** O que a troca de versão do deck fez com o progresso. */
export interface RelatorioMigracao {
  readonly houveTroca: boolean;
  readonly deVersao: string | null;
  readonly paraVersao: string;
  /** Cartões que continuam no deck e mantiveram o progresso. */
  readonly mantidos: readonly string[];
  /** Cartões do novo deck sem histórico algum: começam do zero. */
  readonly novos: readonly string[];
  /** Cartões com histórico que saíram do deck; o log continua guardando tudo. */
  readonly arquivados: readonly string[];
  /** Cartões cujo histórico estava fora do deck anterior e voltou a ser projetado. */
  readonly restaurados: readonly string[];
}

/** Cartões sobre os quais existe alguma revisão registrada ou estado herdado. */
function comHistorico(estado: EstadoPersistido): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const r of estado.log) ids.add(r.cartaoId);
  for (const e of estado.base) {
    if (e.proximaRevisao !== null || e.n > 0) ids.add(e.cartaoId);
  }
  return ids;
}

/**
 * Ajusta o registro guardado ao deck vigente.
 *
 * No modelo 2 isso é quase só trocar o deck: `base` e `log` ficam intactos, e a
 * projeção decide o que aparece. As consequências, todas cobertas por teste:
 *
 * - cartão que continua no deck mantém seu estado SM-2, porque a dobra é a mesma;
 * - cartão novo no deck não tem revisão no log e começa devido;
 * - cartão que sai do deck **não perde nada**: suas revisões seguem no log,
 *   apenas deixam de ser projetadas;
 * - cartão que volta ao deck reaparece com todo o histórico aplicado.
 *
 * A identidade do cartão é o `id` da §5. Um cartão cujo `id` mudou é, para todos
 * os efeitos, outro cartão — não há como reconciliar isso sem inventar conteúdo.
 */
export function migrarParaDeck(
  anterior: EstadoPersistido | null,
  deck: DeckIdentificado,
  agora: number,
): { readonly estado: EstadoPersistido; readonly relatorio: RelatorioMigracao } {
  const vazio: readonly Revisao[] = [];

  if (anterior === null) {
    return {
      estado: {
        versaoModelo: VERSAO_MODELO,
        deck: { id: deck.id, versao: deck.versao, cartoes: deck.cartoes },
        base: [],
        log: vazio,
        atualizadoEm: agora,
      },
      relatorio: {
        houveTroca: false,
        deVersao: null,
        paraVersao: deck.versao,
        mantidos: [],
        novos: deck.cartoes.map((c) => c.id),
        arquivados: [],
        restaurados: [],
      },
    };
  }

  const historico = comHistorico(anterior);

  if (anterior.deck.id === deck.id && anterior.deck.versao === deck.versao) {
    return {
      estado: anterior,
      relatorio: {
        houveTroca: false,
        deVersao: anterior.deck.versao,
        paraVersao: deck.versao,
        mantidos: deck.cartoes.map((c) => c.id).filter((id) => historico.has(id)),
        novos: deck.cartoes.map((c) => c.id).filter((id) => !historico.has(id)),
        arquivados: [],
        restaurados: [],
      },
    };
  }

  const idsAnteriores = new Set(anterior.deck.cartoes.map((c) => c.id));
  const idsNovos = new Set(deck.cartoes.map((c) => c.id));

  const mantidos: string[] = [];
  const novos: string[] = [];
  const restaurados: string[] = [];

  for (const cartao of deck.cartoes) {
    if (!historico.has(cartao.id)) novos.push(cartao.id);
    else if (idsAnteriores.has(cartao.id)) mantidos.push(cartao.id);
    else restaurados.push(cartao.id);
  }

  const arquivados = [...historico].filter((id) => !idsNovos.has(id)).sort();

  return {
    estado: {
      versaoModelo: VERSAO_MODELO,
      deck: { id: deck.id, versao: deck.versao, cartoes: deck.cartoes },
      base: anterior.base,
      log: anterior.log,
      atualizadoEm: agora,
    },
    relatorio: {
      houveTroca: true,
      deVersao: anterior.deck.versao,
      paraVersao: deck.versao,
      mantidos,
      novos,
      arquivados,
      restaurados,
    },
  };
}
