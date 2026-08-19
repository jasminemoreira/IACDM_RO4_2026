/**
 * Módulo M-01 `scheduler` — SM-2 da §4 de REQUISITOS.md, puro e sem I/O.
 *
 * Esta é a ÚNICA encarnação do algoritmo congelado (contrato C-1): tanto a revisão
 * ao vivo quanto o replay da reconciliação passam por `applyReview`.
 *
 * Fonte normativa: REQUISITOS.md §4 (congelada).
 * Fonte histórica:  specs/references/sm2-original.md (Wozniak, 1990).
 * Port literal:     specs/examples/sm2-referencia.md.
 * Vetores:          specs/datasets/sm2-vetores.md (V1–V22).
 *
 * TRÊS ARMADILHAS — não "consertar" nenhuma para o SM-2 original:
 *   D1: a atualização de EF fica FORA do se/senão, logo o EF cai também em q < 3.
 *       O original diz "without changing the E-Factor"; a §4 congelada prevalece.
 *   D3: `round` é half-up (Math.round), não teto e não banker's rounding.
 *   ordem: o intervalo usa o EF ANTERIOR; o EF só é atualizado depois.
 */

export type Grade = 0 | 1 | 2 | 3 | 4 | 5

/** Intervalo em DIAS. A unidade vive no tipo, não em comentário (LING-04). */
export type Days = number & { readonly __brand: 'Days' }

/** Dia local no formato 'YYYY-MM-DD'. Nunca recalculado a partir de outro fuso (A-10). */
export type LocalDay = string & { readonly __brand: 'LocalDay' }

export type SchedState = {
  readonly n: number
  readonly ef: number
  readonly i: Days
}

/** `i = 0` significa "nunca revisado" — convenção deste projeto, não de Wozniak (SCI-01). */
export const INITIAL: SchedState = { n: 0, ef: 2.5, i: 0 as Days }

export const EF_FLOOR = 1.3
export const EF_INITIAL = 2.5

export function isGrade(v: unknown): v is Grade {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 5
}

/**
 * §4, literal. Devolve o novo estado de agendamento.
 * A ordem das operações é normativa: intervalo primeiro (com o EF anterior),
 * fator de facilidade depois.
 */
export function applyReview(s: SchedState, q: Grade): SchedState {
  let n = s.n
  let i = s.i as number

  if (q >= 3) {
    if (n === 0) i = 1
    else if (n === 1) i = 6
    else i = Math.round(i * s.ef) // D3: half-up
    n = n + 1
  } else {
    n = 0
    i = 1
  }

  // D1: FORA do se/senão — o EF cai também em falha.
  let ef = s.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (ef < EF_FLOOR) ef = EF_FLOOR

  return { n, ef, i: i as Days }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isLocalDay(v: unknown): v is LocalDay {
  if (typeof v !== 'string' || !DAY_RE.test(v)) return false
  const [y, m, d] = v.split('-').map(Number) as [number, number, number]
  const probe = new Date(Date.UTC(y, m - 1, d))
  // Rejeita 2026-02-30 e afins, que o regex sozinho aceitaria.
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  )
}

/** Formata uma data JÁ DADA como dia local. Não lê relógio — pureza de C-1. */
export function localDayOf(date: Date): LocalDay {
  const y = String(date.getFullYear()).padStart(4, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}` as LocalDay
}

/**
 * Vencimento = dia local da revisão + I dias (D4).
 *
 * SCI-03: isto é aritmética de CALENDÁRIO, feita em UTC sobre os componentes da
 * data. Somar `i * 86_400_000` ms ao horário local erraria em transição de
 * horário de verão — o Brasil já teve DST e pode voltar a ter.
 */
export function nextDueDay(day: LocalDay, i: Days): LocalDay {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const shifted = new Date(Date.UTC(y, m - 1, d + (i as number)))
  const yy = String(shifted.getUTCFullYear()).padStart(4, '0')
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(shifted.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}` as LocalDay
}

/** Cartão nunca revisado (`due === null`) está devido agora. Ordem ISO é lexicográfica. */
export function isDue(due: LocalDay | null, today: LocalDay): boolean {
  return due === null || due <= today
}
