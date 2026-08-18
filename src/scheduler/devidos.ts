import type { EstadoCartao } from './tipos.js';

/** Um cartão está devido se nunca foi revisado ou se o prazo já chegou. */
export function estaDevido(estado: EstadoCartao, agora: number): boolean {
  return estado.proximaRevisao === null || estado.proximaRevisao <= agora;
}

/**
 * Cartões devidos em `agora`, ordenados de forma determinística:
 * nunca revisados primeiro, depois os de prazo mais antigo, desempate por id.
 */
export function selecionarDevidos(
  estados: readonly EstadoCartao[],
  agora: number,
): readonly EstadoCartao[] {
  return estados
    .filter((e) => estaDevido(e, agora))
    .slice()
    .sort((a, b) => {
      const pa = a.proximaRevisao ?? Number.NEGATIVE_INFINITY;
      const pb = b.proximaRevisao ?? Number.NEGATIVE_INFINITY;
      if (pa !== pb) return pa - pb;
      return a.cartaoId.localeCompare(b.cartaoId);
    });
}
