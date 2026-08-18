/** Nota de recall, 0 a 5 (§4 do brief). */
export type Nota = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Estado SM-2 de um cartão.
 *
 * `proximaRevisao` é `null` enquanto o cartão nunca foi revisado — nesse caso
 * ele está devido desde sempre.
 */
export interface EstadoCartao {
  readonly cartaoId: string;
  /** Número de repetições consecutivas com `q >= 3`. */
  readonly n: number;
  /** Fator de facilidade (*ease factor*), inicial 2,5, piso 1,3. */
  readonly ef: number;
  /** Intervalo `I` em dias. Zero enquanto o cartão nunca foi revisado. */
  readonly intervaloDias: number;
  /** Instante da próxima revisão, em epoch ms. */
  readonly proximaRevisao: number | null;
}
