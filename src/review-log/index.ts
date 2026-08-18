/**
 * review-log — o FATO registrado, e as duas operações que o transformam em estado.
 *
 * A distinção central do projeto vive aqui: o evento de revisão é a verdade, e
 * (n, EF, I) é função dele. É isso que faz "nenhuma revisão perdida" ser propriedade
 * estrutural em vez de promessa — ver specs/references/optimistic-replication.md.
 *
 * A união de eventos é comutativa, associativa e idempotente (G-Set, Shapiro et al. 2011),
 * logo converge sem coordenação. A dobra do SM-2 NÃO comuta, e por isso a ordem total
 * precisa ser idêntica nas duas réplicas — Lamport (1978), desempate por identificador.
 *
 * Puro. Não conhece deck: guarda `cardId` como chave opaca.
 */

import { applyGrade, initialState, type Grade, type SchedulingState } from "../scheduler/index.ts";

/** O que `session` produz e `storage` carimba. Ainda não é um fato: não tem identidade. */
export type ReviewDraft = {
  readonly cardId: string;
  readonly q: Grade;
};

export type ReviewEvent = {
  /** `${replicaId}#${seq}` — único por réplica; a união deduplica por ele */
  readonly eventId: string;
  readonly cardId: string;
  readonly q: Grade;
  /** epoch ms; ordena, não identifica */
  readonly at: number;
  readonly replicaId: string;
  /** contador da réplica, alocado na mesma transação do append (A-4) */
  readonly seq: number;
  /** sequência atribuída pelo servidor; null = ainda não entregue.
   *  V(4): o estado de entrega vive AQUI, e não num registro à parte. */
  readonly sseq: number | null;
};

export function eventIdDe(replicaId: string, seq: number): string {
  return `${replicaId}#${seq}`;
}

/**
 * LIN-02: a comparação de `replicaId` é por UNIDADE DE CÓDIGO UTF-16 (`<`), nunca
 * por locale — `localeCompare` daria ordens diferentes em máquinas diferentes, e a
 * dobra divergiria exatamente onde a ordem total existe para impedir.
 */
export function orderKey(e: ReviewEvent): [number, string, number] {
  return [e.at, e.replicaId, e.seq];
}

export function compare(a: ReviewEvent, b: ReviewEvent): number {
  if (a.at !== b.at) return a.at - b.at;
  if (a.replicaId !== b.replicaId) return a.replicaId < b.replicaId ? -1 : 1;
  return a.seq - b.seq;
}

/**
 * Quando o mesmo `eventId` aparece duas vezes, escolhe deterministicamente — e a
 * escolha tem de ser a mesma nas duas réplicas, independentemente da ordem dos
 * argumentos, ou a convergência quebra.
 *
 * Regra: vence quem carrega MAIS informação (sseq atribuído); empatando, o menor
 * sseq; empatando ainda, a forma canônica lexicograficamente menor. O último caso só
 * ocorre com evento forjado (SEC-09) e é resolvido sem consultar quem chegou primeiro.
 */
function preferir(a: ReviewEvent, b: ReviewEvent): ReviewEvent {
  if (a.sseq !== null && b.sseq === null) return a;
  if (b.sseq !== null && a.sseq === null) return b;
  if (a.sseq !== null && b.sseq !== null && a.sseq !== b.sseq) return a.sseq < b.sseq ? a : b;
  const ca = canonicalForm(a);
  const cb = canonicalForm(b);
  return ca <= cb ? a : b;
}

function canonicalForm(e: ReviewEvent): string {
  return `${e.eventId}|${e.cardId}|${e.q}|${e.at}|${e.replicaId}|${e.seq}`;
}

/** União (G-Set): comutativa, associativa e idempotente. Devolve em ordem total. */
export function merge(...logs: readonly (readonly ReviewEvent[])[]): ReviewEvent[] {
  const porId = new Map<string, ReviewEvent>();
  for (const log of logs) {
    for (const e of log) {
      const existente = porId.get(e.eventId);
      porId.set(e.eventId, existente ? preferir(existente, e) : e);
    }
  }
  return [...porId.values()].sort(compare);
}

/** Aplicação incremental — O(1) por nota, para o caminho quente. */
export function applyOne(estado: SchedulingState | undefined, e: ReviewEvent): SchedulingState {
  return applyGrade(estado ?? initialState(), e.q, e.at);
}

/**
 * Dobra determinística: mesma entrada, mesmo resultado, em qualquer réplica.
 * Ordena SEMPRE antes de dobrar — receber os eventos em outra ordem não pode mudar nada.
 */
export function fold(events: readonly ReviewEvent[]): Map<string, SchedulingState> {
  const estados = new Map<string, SchedulingState>();
  for (const e of [...events].sort(compare)) {
    estados.set(e.cardId, applyOne(estados.get(e.cardId), e));
  }
  return estados;
}

/** Maior `sseq` conhecido: o cursor de leitura de V(4), DERIVADO do log. */
export function maxSseq(events: readonly ReviewEvent[]): number {
  let maior = 0;
  for (const e of events) if (e.sseq !== null && e.sseq > maior) maior = e.sseq;
  return maior;
}

/** Pendentes de envio: eventos sem `sseq`. Também derivado — não há registro à parte. */
export function pendentes(events: readonly ReviewEvent[]): ReviewEvent[] {
  return events.filter((e) => e.sseq === null).sort(compare);
}
