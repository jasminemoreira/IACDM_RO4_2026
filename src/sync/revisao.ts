import type { Nota } from '../scheduler/index.js';
import { ehNota } from '../scheduler/index.js';

/**
 * Uma revisão registrada, como fato imutável.
 *
 * O estado SM-2 de um cartão é uma *dobra* sobre estes fatos. Guardar só a
 * dobra tornaria impossível reconciliar dois dispositivos sem descartar
 * revisões de um dos lados — que é exatamente o que o Incremento 3 proíbe.
 * Por isso a revisão, e não o estado, é o que se persiste e se sincroniza.
 */
export interface Revisao {
  /** Identidade global do fato: `<dispositivo>-<sequência>`. */
  readonly id: string;
  readonly dispositivo: string;
  readonly cartaoId: string;
  readonly q: Nota;
  /** Instante em que a revisão aconteceu, em epoch ms. */
  readonly em: number;
}

/** Registro de revisão malformado. */
export class ErroRevisaoInvalida extends Error {
  override readonly name = 'ErroRevisaoInvalida';
}

/**
 * Ordem total sobre as revisões: por instante e, em empate, por id.
 *
 * É esta ordem que faz dois dispositivos que uniram o mesmo conjunto de fatos
 * chegarem exatamente ao mesmo estado. O desempate por id existe porque dois
 * relógios podem marcar o mesmo milissegundo.
 */
export function compararRevisoes(a: Revisao, b: Revisao): number {
  if (a.em !== b.em) return a.em - b.em;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function ordenar(log: readonly Revisao[]): readonly Revisao[] {
  return [...log].sort(compararRevisoes);
}

/**
 * União de dois logs, sem perda e sem duplicata.
 *
 * A identidade é o `id` do fato: a mesma revisão vista pelos dois lados entra
 * uma vez só, e revisões distintas dos dois lados entram todas. A união é
 * comutativa, associativa e idempotente — sincronizar de novo não muda nada.
 */
export function unir(a: readonly Revisao[], b: readonly Revisao[]): readonly Revisao[] {
  const porId = new Map<string, Revisao>();
  for (const revisao of [...a, ...b]) {
    if (!porId.has(revisao.id)) porId.set(revisao.id, revisao);
  }
  return ordenar([...porId.values()]);
}

/** Quantas revisões deste dispositivo já existem no log. */
function sequenciaDe(log: readonly Revisao[], dispositivo: string): number {
  let maior = 0;
  for (const revisao of log) {
    if (revisao.dispositivo !== dispositivo) continue;
    const sufixo = Number(revisao.id.slice(dispositivo.length + 1));
    if (Number.isInteger(sufixo) && sufixo > maior) maior = sufixo;
  }
  return maior;
}

/** Cria a próxima revisão deste dispositivo, com id que não colide com o log. */
export function novaRevisao(
  log: readonly Revisao[],
  dispositivo: string,
  cartaoId: string,
  q: Nota,
  em: number,
): Revisao {
  return {
    id: `${dispositivo}-${sequenciaDe(log, dispositivo) + 1}`,
    dispositivo,
    cartaoId,
    q,
    em,
  };
}

function ehTexto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length > 0;
}

/** Valida uma revisão vinda do disco ou da rede. */
export function parseRevisao(bruto: unknown, onde: string): Revisao {
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) {
    throw new ErroRevisaoInvalida(`${onde}: revisão não é um objeto`);
  }
  const r = bruto as Record<string, unknown>;

  for (const campo of ['id', 'dispositivo', 'cartaoId'] as const) {
    if (!ehTexto(r[campo])) throw new ErroRevisaoInvalida(`${onde}: campo "${campo}" inválido`);
  }
  if (!ehNota(r['q'])) throw new ErroRevisaoInvalida(`${onde}: nota fora de 0..5`);
  if (typeof r['em'] !== 'number' || !Number.isFinite(r['em'])) {
    throw new ErroRevisaoInvalida(`${onde}: instante inválido`);
  }

  return {
    id: r['id'] as string,
    dispositivo: r['dispositivo'] as string,
    cartaoId: r['cartaoId'] as string,
    q: r['q'],
    em: r['em'],
  };
}

export function parseLog(bruto: unknown, onde = 'log'): readonly Revisao[] {
  if (!Array.isArray(bruto)) throw new ErroRevisaoInvalida(`${onde}: não é uma lista`);
  return ordenar(bruto.map((r, i) => parseRevisao(r, `${onde}[${i}]`)));
}
