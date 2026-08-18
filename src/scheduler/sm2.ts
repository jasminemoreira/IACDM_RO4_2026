import type { EstadoCartao, Nota } from './tipos.js';

export const EF_INICIAL = 2.5;
export const EF_MINIMO = 1.3;
export const NOTA_MINIMA_ACERTO: Nota = 3;
export const MS_POR_DIA = 86_400_000;

/** Nota inválida entregue ao agendador. */
export class ErroNotaInvalida extends Error {
  override readonly name = 'ErroNotaInvalida';
}

export function estadoInicial(cartaoId: string): EstadoCartao {
  return { cartaoId, n: 0, ef: EF_INICIAL, intervaloDias: 0, proximaRevisao: null };
}

export function ehNota(valor: unknown): valor is Nota {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor <= 5;
}

/**
 * Aplica SM-2 exatamente como especificado na §4 do brief.
 *
 * Duas leituras do pseudocódigo, fixadas aqui:
 * - o novo intervalo usa o `EF` **anterior**, porque a linha `I = round(I_anterior * EF)`
 *   precede a atualização de `EF`;
 * - `EF` é atualizado nos dois ramos, acerto e erro, porque a linha está fora do `se`.
 */
export function revisar(estado: EstadoCartao, q: Nota, agora: number): EstadoCartao {
  if (!ehNota(q)) {
    throw new ErroNotaInvalida(`nota deve ser um inteiro de 0 a 5, recebido: ${String(q)}`);
  }

  let n: number;
  let intervaloDias: number;

  if (q >= NOTA_MINIMA_ACERTO) {
    if (estado.n === 0) intervaloDias = 1;
    else if (estado.n === 1) intervaloDias = 6;
    else intervaloDias = Math.round(estado.intervaloDias * estado.ef);
    n = estado.n + 1;
  } else {
    n = 0;
    intervaloDias = 1;
  }

  const ef = Math.max(EF_MINIMO, estado.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  return {
    cartaoId: estado.cartaoId,
    n,
    ef,
    intervaloDias,
    proximaRevisao: agora + intervaloDias * MS_POR_DIA,
  };
}
