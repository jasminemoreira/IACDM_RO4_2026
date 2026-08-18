/**
 * scheduler — o SM-2 da §4 de REQUISITOS.md, literal.
 *
 * Fonte: Woźniak, P. A. (1990), "Optimization of learning", conferida linha a linha
 * em specs/references/sm2-wozniak.md. Nenhum valor aqui foi escolhido por plausibilidade.
 *
 * Puro: sem I/O e sem relógio implícito — o instante entra por parâmetro.
 */

export type Grade = 0 | 1 | 2 | 3 | 4 | 5;

export type SchedulingState = {
  /** repetições consecutivas com q >= 3 */
  readonly n: number;
  /** easiness factor; inicial 2,5, piso 1,3 */
  readonly ef: number;
  /** intervalo em DIAS */
  readonly interval: number;
  /** epoch ms; null = nunca revisado */
  readonly lastReviewedAt: number | null;
};

/** §4: "With all items associate an E-Factor equal to 2.5." */
export const EF_INICIAL = 2.5;
/** §4: "If EF is less than 1.3 then let EF be 1.3." */
export const EF_PISO = 1.3;
/** A-13: um dia são 86 400 000 ms exatos — sem horário de verão, sem segundo bissexto. */
export const DIA_MS = 86_400_000;

export function initialState(): SchedulingState {
  return { n: 0, ef: EF_INICIAL, interval: 0, lastReviewedAt: null };
}

/** I-2 / A-10: q é inteiro em [0,5]. Usado pelas fronteiras de entrada. */
export function isGrade(v: unknown): v is Grade {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 5;
}

/**
 * §4, na ORDEM PUBLICADA: o intervalo é computado com o EF **anterior**,
 * e só então o EF é atualizado. Trocar a ordem muda o resultado — ver o vetor V-3
 * em specs/datasets/sm2-vectors.md, passo 3: round(6 × 2.7) = 16.
 */
export function applyGrade(s: SchedulingState, q: Grade, at: number): SchedulingState {
  if (!isGrade(q)) throw new RangeError(`nota fora de [0,5]: ${String(q)}`);

  let n = s.n;
  let interval = s.interval;

  if (q >= 3) {
    if (n === 0) interval = 1;
    else if (n === 1) interval = 6;
    // SCI-01: a §4 escreve "round" sem fixar o desempate de 0,5, e a fonte também não.
    // Fixado aqui: Math.round, que arredonda meio para +∞.
    else interval = Math.round(interval * s.ef);
    n = n + 1;
  } else {
    n = 0;
    interval = 1;
  }

  let ef = s.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ef < EF_PISO) ef = EF_PISO;

  // A-16: o EF NUNCA é arredondado. A convergência entre réplicas exige
  // identidade bit a bit IEEE 754.
  return { n, ef, interval, lastReviewedAt: at };
}

/** I-7: cartão nunca revisado é devido imediatamente. */
export function dueAt(s: SchedulingState): number {
  return s.lastReviewedAt === null ? 0 : s.lastReviewedAt + s.interval * DIA_MS;
}

export function isDue(s: SchedulingState, now: number): boolean {
  return dueAt(s) <= now;
}
