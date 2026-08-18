/**
 * session — a travessia da fila de devidos. Pura.
 *
 * A-14: a fila é apurada NA ABERTURA e não é reavaliada. É isso que garante que
 * toda sessão termina em no máximo |devidos na abertura| apresentações (VAL-06),
 * por construção e não por heurística de parada.
 *
 * ARQ-07 / IMP-03: `grade` produz apenas um RASCUNHO, com token de correspondência.
 * Avançar exige `commit` com o evento já gravado. A garantia "grava antes de avançar"
 * está no tipo, não na prosa.
 */

import { dueAt, isDue, initialState, type Grade, type SchedulingState } from "../scheduler/index.ts";
import { cardById, type Card, type CardId, type Deck } from "../deck/index.ts";
import type { ReviewDraft, ReviewEvent } from "../review-log/index.ts";

export type Session = {
  readonly fila: readonly CardId[];
  readonly cursor: number;
  readonly revelado: boolean;
  /** muda a cada `open`; invalida rascunhos de sessões anteriores */
  readonly geracao: number;
  readonly abertaEm: number;
};

export type SessionDraft = ReviewDraft & { readonly token: string };

export class SessionError extends Error {
  override readonly name = "SessionError";
}

let proximaGeracao = 1;

/**
 * IMP-04: a ordem da fila é `(dueAt ascendente, id ascendente)` — determinística e
 * declarada. Duas implementações do contrato apresentam os cartões na mesma ordem.
 */
export function open(deck: Deck, estados: ReadonlyMap<CardId, SchedulingState>, now: number): Session {
  const devidos = deck.cards
    .map((c) => ({ id: c.id, estado: estados.get(c.id) ?? initialState() }))
    .filter((x) => isDue(x.estado, now))
    .sort((a, b) => {
      const da = dueAt(a.estado);
      const db = dueAt(b.estado);
      if (da !== db) return da - db;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((x) => x.id);

  return { fila: devidos, cursor: 0, revelado: false, geracao: proximaGeracao++, abertaEm: now };
}

export function isComplete(s: Session): boolean {
  return s.cursor >= s.fila.length;
}

export function currentId(s: Session): CardId | null {
  return isComplete(s) ? null : (s.fila[s.cursor] ?? null);
}

export function current(s: Session, deck: Deck): Card | null {
  const id = currentId(s);
  return id === null ? null : cardById(deck, id);
}

export function reveal(s: Session): Session {
  if (isComplete(s)) return s;
  return { ...s, revelado: true };
}

export function restantes(s: Session): number {
  return Math.max(0, s.fila.length - s.cursor);
}

function tokenDe(s: Session, cardId: CardId): string {
  return `${s.geracao}#${s.cursor}#${cardId}`;
}

/**
 * Produz o rascunho da revisão. NÃO avança nada: quem avança é `commit`, e só
 * depois de o evento existir de verdade.
 */
export function grade(s: Session, q: Grade): SessionDraft {
  const cardId = currentId(s);
  if (cardId === null) throw new SessionError("sessão concluída: não há cartão para notar");
  return { cardId, q, token: tokenDe(s, cardId) };
}

/**
 * ARQ-07: recusa rascunho que não seja do cartão corrente desta geração de sessão,
 * e recusa evento que não corresponda ao rascunho. Rascunho velho, cartão trocado ou
 * sessão reaberta no meio do caminho param aqui, e não viram avanço indevido.
 */
export function commit(s: Session, draft: SessionDraft, evento: ReviewEvent): Session {
  const cardId = currentId(s);
  if (cardId === null) throw new SessionError("sessão concluída: nada a comprometer");
  if (draft.token !== tokenDe(s, cardId)) {
    throw new SessionError(`rascunho não corresponde ao cartão corrente (${draft.token})`);
  }
  if (evento.cardId !== draft.cardId || evento.q !== draft.q) {
    throw new SessionError("evento não corresponde ao rascunho");
  }
  return { ...s, cursor: s.cursor + 1, revelado: false };
}
