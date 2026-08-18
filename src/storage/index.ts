/**
 * storage — a porta Repository e seus adaptadores.
 *
 * A porta é o único lugar que carimba identidade. V(4): o estado de entrega vive
 * DENTRO de cada evento (campo `sseq`), e não num registro à parte — foi assim que
 * ASS-12 e ASS-13 deixaram de ser possíveis, em vez de apenas consertados.
 *
 * A-4: `eventId = ${replicaId}#${seq}`, com `seq` alocado ao lado do `replicaId`.
 * O par só reinicia se os dois reiniciarem juntos, e aí não há colisão.
 *
 * Incremento 1 traz apenas o adaptador em memória (§6: "sem persistência além da
 * sessão em memória"). O adaptador IndexedDB entra no Incremento 2.
 */

import { eventIdDe, maxSseq as maiorSseq, pendentes, type ReviewDraft, type ReviewEvent } from "../review-log/index.ts";
import { isGrade } from "../scheduler/index.ts";

export type ModoArmazenamento = "idb" | "memoria";

export type StorageHealth = {
  readonly eventos: number;
  readonly pendentes: number;
  readonly maxSseq: number;
  readonly epoch: string | null;
  readonly modo: ModoArmazenamento;
  readonly proximoSeq: number;
};

export type Entrega = { readonly eventId: string; readonly sseq: number };

export interface ReviewRepository {
  /** Carimba identidade e instante, e devolve o FATO. Único caminho para evento local. */
  append(draft: ReviewDraft): Promise<ReviewEvent>;
  /** ASS-07: eventos remotos entram VERBATIM, sem recarimbar identidade alheia. */
  ingest(events: readonly ReviewEvent[]): Promise<{ novos: number; jaConhecidos: number }>;
  all(): Promise<ReviewEvent[]>;
  /** Derivado: eventos com `sseq` nulo. Não há registro de marca d'água. */
  pending(): Promise<ReviewEvent[]>;
  markDelivered(entradas: readonly Entrega[]): Promise<void>;
  /** Derivado: `maxSseq` sobre o log. */
  cursor(): Promise<{ maxSseq: number; epoch: string | null }>;
  /** ASS-13: trocar de epoch LIMPA o `sseq` de todos os eventos — tudo é reenviado e repuxado. */
  setEpoch(epoch: string): Promise<void>;
  replicaId(): Promise<string>;
  deckVersion(): Promise<string | null>;
  setDeckVersion(v: string): Promise<void>;
  health(): Promise<StorageHealth>;
  mode(): ModoArmazenamento;
}

export class StorageError extends Error {
  override readonly name = "StorageError";
}

export type Relogio = () => number;

export type OpcoesMemoria = {
  readonly replicaId?: string;
  readonly agora?: Relogio;
  readonly eventos?: readonly ReviewEvent[];
};

export function novoReplicaId(): string {
  // A-5: único entre dispositivos. Sem dependência: 16 hex de aleatoriedade da plataforma.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Adaptador em memória. É também o adaptador de teste: é ele que permite ao cenário
 * de conflito rodar fora do navegador, com relógio injetado.
 */
export function criarMemoria(opcoes: OpcoesMemoria = {}): ReviewRepository {
  const replica = opcoes.replicaId ?? novoReplicaId();
  const agora = opcoes.agora ?? (() => Date.now());
  const eventos = new Map<string, ReviewEvent>();
  let deckVersion: string | null = null;
  let epoch: string | null = null;

  for (const e of opcoes.eventos ?? []) eventos.set(e.eventId, e);

  /** SEC-09 / A-4: nunca reemitir um `seq` já usado por esta réplica, mesmo que um
   *  evento nosso tenha voltado de fora com `seq` à frente do contador. */
  function proximoSeq(): number {
    let maior = 0;
    for (const e of eventos.values()) if (e.replicaId === replica && e.seq > maior) maior = e.seq;
    return maior + 1;
  }

  /** A-4 / CTL-03: `at` é monotônico usando SÓ o último instante LOCAL — evento remoto
   *  com carimbo no futuro reordena, mas nunca contamina os nossos carimbos seguintes. */
  function proximoAt(): number {
    let ultimoLocal = 0;
    for (const e of eventos.values()) if (e.replicaId === replica && e.at > ultimoLocal) ultimoLocal = e.at;
    return Math.max(agora(), ultimoLocal);
  }

  return {
    mode: () => "memoria",

    async append(draft: ReviewDraft): Promise<ReviewEvent> {
      if (!isGrade(draft.q)) throw new StorageError(`nota fora de [0,5]: ${String(draft.q)}`);
      if (typeof draft.cardId !== "string" || draft.cardId.length === 0) {
        throw new StorageError("cardId ausente");
      }
      const seq = proximoSeq();
      const evento: ReviewEvent = {
        eventId: eventIdDe(replica, seq),
        cardId: draft.cardId,
        q: draft.q,
        at: proximoAt(),
        replicaId: replica,
        seq,
        sseq: null,
      };
      eventos.set(evento.eventId, evento);
      return evento;
    },

    async ingest(entrada: readonly ReviewEvent[]) {
      let novos = 0;
      let jaConhecidos = 0;
      for (const bruto of entrada as readonly unknown[]) {
        if (!validaEventoRemoto(bruto)) {
          const id = (bruto as { eventId?: unknown } | null)?.eventId;
          throw new StorageError(`evento remoto inválido: ${String(id)}`);
        }
        const e: ReviewEvent = bruto;
        // SEC-09: um evento que reivindica a NOSSA identidade e que não temos é forjado.
        if (e.replicaId === replica && !eventos.has(e.eventId)) {
          throw new StorageError(`evento forjado com nossa identidade: ${e.eventId}`);
        }
        const existente = eventos.get(e.eventId);
        if (existente) {
          jaConhecidos++;
          // Preferir a versão que carrega `sseq` — é a que tem mais informação.
          if (existente.sseq === null && e.sseq !== null) eventos.set(e.eventId, { ...existente, sseq: e.sseq });
        } else {
          eventos.set(e.eventId, e);
          novos++;
        }
      }
      return { novos, jaConhecidos };
    },

    async all() {
      return [...eventos.values()];
    },

    async pending() {
      return pendentes([...eventos.values()]).filter((e) => e.replicaId === replica);
    },

    async markDelivered(entradas: readonly Entrega[]) {
      for (const { eventId, sseq } of entradas) {
        const e = eventos.get(eventId);
        if (e) eventos.set(eventId, { ...e, sseq });
      }
    },

    async cursor() {
      return { maxSseq: maiorSseq([...eventos.values()]), epoch };
    },

    async setEpoch(novo: string) {
      if (epoch !== null && epoch !== novo) {
        // ASS-13: o servidor é outro. Tudo volta a ser pendente E a ser repuxado.
        for (const [id, e] of eventos) eventos.set(id, { ...e, sseq: null });
      }
      epoch = novo;
    },

    async replicaId() {
      return replica;
    },

    async deckVersion() {
      return deckVersion;
    },

    async setDeckVersion(v: string) {
      if (v.length === 0) throw new StorageError("versão de deck vazia (LIN-03)");
      deckVersion = v;
    },

    async health() {
      const lista = [...eventos.values()];
      return {
        eventos: lista.length,
        pendentes: lista.filter((e) => e.sseq === null).length,
        maxSseq: maiorSseq(lista),
        epoch,
        modo: "memoria" as const,
        proximoSeq: proximoSeq(),
      };
    },
  };
}

/** SEC-05: nada vindo de fora entra sem conferência. */
export function validaEventoRemoto(e: unknown): e is ReviewEvent {
  if (typeof e !== "object" || e === null) return false;
  const r = e as Record<string, unknown>;
  return (
    typeof r["eventId"] === "string" && r["eventId"].length > 0 &&
    typeof r["cardId"] === "string" && r["cardId"].length > 0 &&
    isGrade(r["q"]) &&
    typeof r["at"] === "number" && Number.isFinite(r["at"]) &&
    typeof r["replicaId"] === "string" && r["replicaId"].length > 0 &&
    typeof r["seq"] === "number" && Number.isInteger(r["seq"]) && r["seq"] > 0 &&
    (r["sseq"] === null || (typeof r["sseq"] === "number" && Number.isInteger(r["sseq"]))) &&
    r["eventId"] === eventIdDe(r["replicaId"] as string, r["seq"] as number)
  );
}
