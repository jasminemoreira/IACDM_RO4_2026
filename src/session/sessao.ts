import type { Cartao, Deck } from '../deck/index.js';
import { cartaoPorId } from '../deck/index.js';
import type { EstadoCartao, Nota } from '../scheduler/index.js';
import { selecionarDevidos } from '../scheduler/index.js';
import type { Progresso } from './progresso.js';
import { estadoDe, registrarNota } from './progresso.js';

/** Uma nota registrada durante a sessão, com o intervalo que ela produziu. */
export interface Resposta {
  readonly cartaoId: string;
  readonly q: Nota;
  readonly intervaloDias: number;
}

/**
 * Uma sessão de revisão.
 *
 * A fila é fixada no início com os cartões devidos naquele instante e cada
 * cartão é respondido uma única vez — por isso a sessão sempre termina. Um
 * cartão com `q < 3` não reentra na fila desta sessão: o SM-2 já o reagenda
 * para o dia seguinte (`I = 1`).
 */
export interface Sessao {
  readonly deck: Deck;
  readonly fila: readonly string[];
  readonly indice: number;
  readonly progresso: Progresso;
  readonly respostas: readonly Resposta[];
}

/** Nota entregue a uma sessão já concluída. */
export class ErroSessaoConcluida extends Error {
  override readonly name = 'ErroSessaoConcluida';
}

export function iniciarSessao(deck: Deck, progresso: Progresso, agora: number): Sessao {
  const estados = deck.map((cartao) => estadoDe(progresso, cartao.id));
  const fila = selecionarDevidos(estados, agora).map((e) => e.cartaoId);
  return { deck, fila, indice: 0, progresso, respostas: [] };
}

export function concluida(sessao: Sessao): boolean {
  return sessao.indice >= sessao.fila.length;
}

export function cartaoAtual(sessao: Sessao): Cartao | null {
  const id = sessao.fila[sessao.indice];
  if (id === undefined) return null;
  return cartaoPorId(sessao.deck, id) ?? null;
}

export function estadoAtual(sessao: Sessao): EstadoCartao | null {
  const id = sessao.fila[sessao.indice];
  return id === undefined ? null : estadoDe(sessao.progresso, id);
}

/** Quantos cartões já foram respondidos e quantos a sessão tem ao todo. */
export function andamento(sessao: Sessao): { readonly respondidos: number; readonly total: number } {
  return { respondidos: sessao.indice, total: sessao.fila.length };
}

/** Registra a nota do cartão atual e avança. Devolve uma nova sessão. */
export function responder(sessao: Sessao, q: Nota, agora: number): Sessao {
  const id = sessao.fila[sessao.indice];
  if (id === undefined) {
    throw new ErroSessaoConcluida('não há cartão atual: a sessão já terminou');
  }

  const progresso = registrarNota(sessao.progresso, id, q, agora);
  const resposta: Resposta = {
    cartaoId: id,
    q,
    intervaloDias: estadoDe(progresso, id).intervaloDias,
  };

  return {
    ...sessao,
    indice: sessao.indice + 1,
    progresso,
    respostas: [...sessao.respostas, resposta],
  };
}
