import type { Deck } from '../deck/index.js';
import type { EstadoCartao, Nota } from '../scheduler/index.js';
import { estadoInicial, revisar } from '../scheduler/index.js';

/**
 * Progresso SM-2 de todos os cartões, indexado por id.
 *
 * No Incremento 1 vive apenas em memória, pelo tempo da sessão.
 */
export type Progresso = ReadonlyMap<string, EstadoCartao>;

/** Cartão referenciado que não existe no progresso. */
export class ErroCartaoDesconhecido extends Error {
  override readonly name = 'ErroCartaoDesconhecido';
}

/** Progresso zerado para um deck: todo cartão começa novo e, portanto, devido. */
export function progressoInicial(deck: Deck): Progresso {
  return new Map(deck.map((cartao) => [cartao.id, estadoInicial(cartao.id)]));
}

export function estadoDe(progresso: Progresso, cartaoId: string): EstadoCartao {
  const estado = progresso.get(cartaoId);
  if (estado === undefined) {
    throw new ErroCartaoDesconhecido(`cartão sem estado no progresso: "${cartaoId}"`);
  }
  return estado;
}

/** Registra uma nota e devolve um novo progresso; o recebido não é alterado. */
export function registrarNota(
  progresso: Progresso,
  cartaoId: string,
  q: Nota,
  agora: number,
): Progresso {
  const atualizado = revisar(estadoDe(progresso, cartaoId), q, agora);
  const proximo = new Map(progresso);
  proximo.set(cartaoId, atualizado);
  return proximo;
}
