import type { Deck } from '../deck/index.js';
import type { EstadoCartao } from '../scheduler/index.js';
import { estadoInicial, revisar } from '../scheduler/index.js';
import type { Progresso } from '../session/index.js';
import type { Revisao } from './revisao.js';
import { ordenar } from './revisao.js';

/**
 * Dobra o log de revisões sobre um estado herdado e produz o progresso SM-2.
 *
 * `base` existe só para o que veio do modelo 1, que guardava a dobra e não os
 * fatos; para um registro nascido no modelo 2 ela é vazia. Revisões de cartões
 * fora do deck vigente continuam no log e são simplesmente não projetadas —
 * é assim que uma troca de versão do deck não descarta nada.
 *
 * A projeção é determinística: mesmo `base` e mesmo conjunto de revisões dão
 * sempre o mesmo progresso, porque a ordem total vem de `compararRevisoes`.
 */
export function projetar(
  base: readonly EstadoCartao[],
  log: readonly Revisao[],
  deck: Deck,
): Progresso {
  const herdado = new Map(base.map((e) => [e.cartaoId, e]));
  const progresso = new Map<string, EstadoCartao>(
    deck.map((cartao) => [cartao.id, herdado.get(cartao.id) ?? estadoInicial(cartao.id)]),
  );

  for (const revisao of ordenar(log)) {
    const atual = progresso.get(revisao.cartaoId);
    if (atual === undefined) continue; // cartão fora do deck vigente
    progresso.set(revisao.cartaoId, revisar(atual, revisao.q, revisao.em));
  }

  return progresso;
}

/** As revisões que o deck vigente não projeta, mas o log preserva. */
export function revisoesForaDoDeck(log: readonly Revisao[], deck: Deck): readonly Revisao[] {
  const ids = new Set(deck.map((c) => c.id));
  return log.filter((r) => !ids.has(r.cartaoId));
}

/** Quantas revisões cada cartão acumulou no log, dentro ou fora do deck. */
export function contarPorCartao(log: readonly Revisao[]): ReadonlyMap<string, number> {
  const contas = new Map<string, number>();
  for (const r of log) contas.set(r.cartaoId, (contas.get(r.cartaoId) ?? 0) + 1);
  return contas;
}
