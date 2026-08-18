import type { DeckIdentificado } from '../deck/index.js';
import { cartaoPorId, catalogoDeDecks } from '../deck/index.js';
import type { Nota } from '../scheduler/index.js';
import type { Progresso, Sessao } from '../session/index.js';
import {
  andamento,
  cartaoAtual,
  concluida,
  iniciarSessao,
  responder as responderSessao,
} from '../session/index.js';
import type { EstadoPersistido, RelatorioMigracao } from '../storage/index.js';
import { progressoDe } from '../storage/index.js';
import type { LinhaResumo, OpcaoDeck, Tela, Visao } from '../ui/index.js';

/** Estado completo da aplicação. */
export interface EstadoApp {
  readonly deck: DeckIdentificado;
  readonly persistido: EstadoPersistido;
  readonly sessao: Sessao;
  readonly revelado: boolean;
  readonly aviso: string | null;
  readonly offline: boolean;
  readonly persistente: boolean;
}

export interface OpcoesInicio {
  readonly deck: DeckIdentificado;
  readonly persistido: EstadoPersistido;
  readonly agora: number;
  readonly aviso?: string | null;
  readonly offline?: boolean;
  readonly persistente?: boolean;
}

export function iniciar(opcoes: OpcoesInicio): EstadoApp {
  return {
    deck: opcoes.deck,
    persistido: opcoes.persistido,
    sessao: iniciarSessao(opcoes.deck.cartoes, progressoDe(opcoes.persistido), opcoes.agora),
    revelado: false,
    aviso: opcoes.aviso ?? null,
    offline: opcoes.offline ?? false,
    persistente: opcoes.persistente ?? true,
  };
}

export function revelar(estado: EstadoApp): EstadoApp {
  return estado.revelado ? estado : { ...estado, revelado: true };
}

/** Registra a nota do cartão atual e volta a esconder a resposta. */
export function responder(estado: EstadoApp, q: Nota, agora: number): EstadoApp {
  return {
    ...estado,
    sessao: responderSessao(estado.sessao, q, agora),
    revelado: false,
  };
}

/** Abre uma nova sessão sobre o progresso acumulado. */
export function reiniciar(estado: EstadoApp, agora: number): EstadoApp {
  return {
    ...estado,
    sessao: iniciarSessao(estado.deck.cartoes, estado.sessao.progresso, agora),
    revelado: false,
  };
}

export function comAviso(estado: EstadoApp, aviso: string | null): EstadoApp {
  return { ...estado, aviso };
}

export function comConexao(estado: EstadoApp, offline: boolean): EstadoApp {
  return { ...estado, offline };
}

/** Substitui o registro persistido depois de uma gravação bem-sucedida. */
export function comPersistido(estado: EstadoApp, persistido: EstadoPersistido): EstadoApp {
  return { ...estado, persistido };
}

/** O progresso corrente da sessão, que é o que deve ser gravado. */
export function progressoCorrente(estado: EstadoApp): Progresso {
  return estado.sessao.progresso;
}

/** Texto de aviso para uma troca de versão do deck. `null` se nada mudou. */
export function avisoDeMigracao(relatorio: RelatorioMigracao): string | null {
  if (!relatorio.houveTroca) return null;

  const partes = [`${relatorio.mantidos.length} com progresso preservado`];
  if (relatorio.restaurados.length > 0) {
    partes.push(`${relatorio.restaurados.length} restaurado(s) do arquivo`);
  }
  if (relatorio.novos.length > 0) partes.push(`${relatorio.novos.length} novo(s)`);
  if (relatorio.arquivados.length > 0) {
    partes.push(`${relatorio.arquivados.length} arquivado(s) sem perda`);
  }
  return `Versão do deck trocada: ${partes.join(', ')}.`;
}

function proximoPrazo(progresso: Progresso): number | null {
  let menor: number | null = null;
  for (const estado of progresso.values()) {
    if (estado.proximaRevisao === null) continue;
    if (menor === null || estado.proximaRevisao < menor) menor = estado.proximaRevisao;
  }
  return menor;
}

/** Deriva o corpo da tela a partir do estado. */
export function visaoDe(estado: EstadoApp): Visao {
  const { sessao } = estado;

  if (!concluida(sessao)) {
    const cartao = cartaoAtual(sessao);
    if (cartao === null) {
      return { tipo: 'erro', mensagem: 'cartão da fila não existe no deck' };
    }
    const { respondidos, total } = andamento(sessao);
    return { tipo: 'revisao', cartao, revelado: estado.revelado, respondidos, total };
  }

  if (sessao.fila.length === 0) {
    return { tipo: 'nada-devido', proximaRevisao: proximoPrazo(sessao.progresso) };
  }

  const respostas: LinhaResumo[] = sessao.respostas.map((r) => {
    const cartao = cartaoPorId(estado.deck.cartoes, r.cartaoId);
    return {
      cartaoId: r.cartaoId,
      hanzi: cartao?.hanzi ?? r.cartaoId,
      gloss: cartao?.gloss ?? '',
      q: r.q,
      intervaloDias: r.intervaloDias,
    };
  });
  return { tipo: 'fim', respostas };
}

function opcoesDeDeck(estado: EstadoApp): readonly OpcaoDeck[] {
  return catalogoDeDecks().map(({ id, rotulo }) => ({
    id,
    rotulo,
    selecionado: id === estado.deck.id,
  }));
}

/** Deriva a tela inteira a partir do estado. Única ponte entre o domínio e a `ui`. */
export function telaDe(estado: EstadoApp): Tela {
  return {
    visao: visaoDe(estado),
    decks: opcoesDeDeck(estado),
    aviso: estado.aviso,
    offline: estado.offline,
    persistente: estado.persistente,
  };
}
