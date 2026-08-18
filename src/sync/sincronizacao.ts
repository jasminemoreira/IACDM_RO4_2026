import type { Remoto } from './remoto.js';
import type { Revisao } from './revisao.js';
import { unir } from './revisao.js';

/** O que uma sincronização moveu. */
export interface ResultadoSync {
  /** O log reconciliado: união do local com o remoto. */
  readonly log: readonly Revisao[];
  /** Revisões que o remoto tinha e este dispositivo não conhecia. */
  readonly recebidas: number;
  /** Revisões deste lado que o remoto não tinha. */
  readonly enviadas: number;
  readonly em: number;
}

/**
 * Reconcilia o log local com o remoto. **Esta é a resolução de conflito.**
 *
 * A regra, por inteiro: *o resultado é a união dos dois conjuntos de revisões,
 * aplicada na ordem total (instante, id).* Não há vencedor e não há descarte —
 * duas revisões concorrentes do mesmo cartão são **ambas** aplicadas, como se
 * tivessem acontecido em sequência num único dispositivo. O estado SM-2 é
 * recalculado dobrando esse log unido.
 *
 * Propriedades, todas cobertas por teste:
 * - **nada se perde**: toda revisão registrada de qualquer lado está no resultado;
 * - **convergência**: os dois dispositivos terminam com o mesmo log e, portanto,
 *   com o mesmo progresso, porque a ordem total não depende de quem sincronizou antes;
 * - **idempotência**: sincronizar de novo, sem revisões novas, não muda nada.
 *
 * O preço assumido: uma revisão antiga que chega tarde é aplicada na sua posição
 * de tempo, o que pode alterar o intervalo já calculado para revisões posteriores
 * daquele cartão. Isso é consequência de não descartar nada — e é o que o
 * Incremento 3 pede.
 */
export async function sincronizar(
  remoto: Remoto,
  local: readonly Revisao[],
  agora: number,
): Promise<ResultadoSync> {
  const doRemoto = await remoto.puxar();

  const idsLocais = new Set(local.map((r) => r.id));
  const idsRemotos = new Set(doRemoto.map((r) => r.id));

  const recebidas = doRemoto.filter((r) => !idsLocais.has(r.id)).length;
  const enviadas = local.filter((r) => !idsRemotos.has(r.id)).length;

  const uniao = unir(local, doRemoto);

  // só escreve se este lado tem algo que o remoto não tem; a resposta pode
  // trazer revisões de um terceiro dispositivo que chegou entre o puxar e o empurrar
  const log = enviadas > 0 ? unir(uniao, await remoto.empurrar(uniao)) : uniao;

  return { log, recebidas, enviadas, em: agora };
}
