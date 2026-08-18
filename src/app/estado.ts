import type { Deck } from '../deck/index.js';
import { cartaoPorId } from '../deck/index.js';
import type { Nota } from '../scheduler/index.js';
import type { Progresso, Sessao } from '../session/index.js';
import {
  andamento,
  cartaoAtual,
  concluida,
  iniciarSessao,
  responder as responderSessao,
} from '../session/index.js';
import type { LinhaResumo, Visao } from '../ui/index.js';

/** Estado completo da aplicação: a sessão corrente mais o que a tela mostra dela. */
export interface EstadoApp {
  readonly deck: Deck;
  readonly sessao: Sessao;
  readonly revelado: boolean;
}

export function iniciar(deck: Deck, progresso: Progresso, agora: number): EstadoApp {
  return { deck, sessao: iniciarSessao(deck, progresso, agora), revelado: false };
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
  return iniciar(estado.deck, estado.sessao.progresso, agora);
}

function proximoPrazo(progresso: Progresso): number | null {
  let menor: number | null = null;
  for (const estado of progresso.values()) {
    if (estado.proximaRevisao === null) continue;
    if (menor === null || estado.proximaRevisao < menor) menor = estado.proximaRevisao;
  }
  return menor;
}

/** Deriva a tela a partir do estado. Única ponte entre o domínio e a `ui`. */
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
    const cartao = cartaoPorId(estado.deck, r.cartaoId);
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
