import type { DeckIdentificado } from '../deck/index.js';
import type { EstadoCartao } from '../scheduler/index.js';
import { estadoInicial } from '../scheduler/index.js';
import type { EstadoPersistido } from './modelo.js';
import { VERSAO_MODELO } from './modelo.js';

/** O que a troca de versão do deck fez com o progresso. */
export interface RelatorioMigracao {
  readonly houveTroca: boolean;
  readonly deVersao: string | null;
  readonly paraVersao: string;
  /** Cartões que continuam no deck e mantiveram o progresso. */
  readonly mantidos: readonly string[];
  /** Cartões novos no deck, que começam do zero. */
  readonly novos: readonly string[];
  /** Cartões que saíram do deck; o progresso deles foi arquivado, não apagado. */
  readonly arquivados: readonly string[];
  /** Cartões arquivados que voltaram ao deck e recuperaram o progresso. */
  readonly restaurados: readonly string[];
}

const RELATORIO_VAZIO = {
  mantidos: [] as readonly string[],
  novos: [] as readonly string[],
  arquivados: [] as readonly string[],
  restaurados: [] as readonly string[],
};

function porId(estados: readonly EstadoCartao[]): Map<string, EstadoCartao> {
  return new Map(estados.map((e) => [e.cartaoId, e]));
}

/**
 * Ajusta o progresso guardado ao deck vigente.
 *
 * Regras, todas cobertas por teste:
 * - cartão que continua no deck mantém seu estado SM-2 intacto;
 * - cartão novo no deck começa com estado inicial e, portanto, devido;
 * - cartão que saiu do deck tem o progresso **arquivado em `orfaos`**, nunca apagado;
 * - cartão arquivado que reaparece no deck volta com o progresso que tinha.
 *
 * A identidade do cartão é o `id` da §5. Um cartão cujo `id` mudou é, para todos
 * os efeitos, outro cartão — não há como reconciliar isso sem inventar conteúdo.
 */
export function migrarParaDeck(
  anterior: EstadoPersistido | null,
  deck: DeckIdentificado,
  agora: number,
): { readonly estado: EstadoPersistido; readonly relatorio: RelatorioMigracao } {
  const novoEstado = (): EstadoPersistido => ({
    versaoModelo: VERSAO_MODELO,
    deck: { id: deck.id, versao: deck.versao, cartoes: deck.cartoes },
    progresso: deck.cartoes.map((c) => estadoInicial(c.id)),
    orfaos: [],
    atualizadoEm: agora,
  });

  if (anterior === null) {
    return {
      estado: novoEstado(),
      relatorio: {
        ...RELATORIO_VAZIO,
        houveTroca: false,
        deVersao: null,
        paraVersao: deck.versao,
        novos: deck.cartoes.map((c) => c.id),
      },
    };
  }

  if (anterior.deck.id === deck.id && anterior.deck.versao === deck.versao) {
    return {
      estado: anterior,
      relatorio: {
        ...RELATORIO_VAZIO,
        houveTroca: false,
        deVersao: anterior.deck.versao,
        paraVersao: deck.versao,
        mantidos: anterior.progresso.map((e) => e.cartaoId),
      },
    };
  }

  const ativos = porId(anterior.progresso);
  const arquivados = porId(anterior.orfaos);
  const idsDoDeck = new Set(deck.cartoes.map((c) => c.id));

  const mantidos: string[] = [];
  const novos: string[] = [];
  const restaurados: string[] = [];

  const progresso: EstadoCartao[] = deck.cartoes.map((cartao) => {
    const ativo = ativos.get(cartao.id);
    if (ativo !== undefined) {
      mantidos.push(cartao.id);
      return ativo;
    }
    const orfao = arquivados.get(cartao.id);
    if (orfao !== undefined) {
      restaurados.push(cartao.id);
      return orfao;
    }
    novos.push(cartao.id);
    return estadoInicial(cartao.id);
  });

  const saiuDoDeck = anterior.progresso.filter((e) => !idsDoDeck.has(e.cartaoId));
  const orfaosRestantes = anterior.orfaos.filter((e) => !idsDoDeck.has(e.cartaoId));

  return {
    estado: {
      versaoModelo: VERSAO_MODELO,
      deck: { id: deck.id, versao: deck.versao, cartoes: deck.cartoes },
      progresso,
      orfaos: [...orfaosRestantes, ...saiuDoDeck],
      atualizadoEm: agora,
    },
    relatorio: {
      houveTroca: true,
      deVersao: anterior.deck.versao,
      paraVersao: deck.versao,
      mantidos,
      novos,
      arquivados: saiuDoDeck.map((e) => e.cartaoId),
      restaurados,
    },
  };
}
