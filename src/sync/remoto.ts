import type { Revisao } from './revisao.js';
import { parseLog, unir } from './revisao.js';

/**
 * O armazenamento remoto, reduzido ao mínimo que a reconciliação exige.
 *
 * Não há bloqueio nem número de versão: `empurrar` envia o log e recebe de
 * volta a união que o remoto passou a guardar. Como a união é comutativa e
 * idempotente, duas escritas concorrentes convergem sem coordenação — nenhum
 * lado precisa esperar o outro, e nada se perde se as duas chegarem juntas.
 */
export interface Remoto {
  readonly descricao: string;
  puxar(): Promise<readonly Revisao[]>;
  empurrar(log: readonly Revisao[]): Promise<readonly Revisao[]>;
}

/** Falha ao falar com o remoto. */
export class ErroRemoto extends Error {
  override readonly name = 'ErroRemoto';
}

/**
 * Duplo local do remoto: guarda o log em memória e une a cada escrita.
 *
 * É o mesmo contrato do remoto HTTP, então os testes de reconciliação valem
 * para os dois.
 */
export function remotoMemoria(inicial: readonly Revisao[] = []): Remoto {
  let guardado: readonly Revisao[] = unir(inicial, []);

  return {
    descricao: 'duplo local em memória',
    puxar: () => Promise.resolve(guardado),
    empurrar: (log) => {
      guardado = unir(guardado, log);
      return Promise.resolve(guardado);
    },
  };
}

type Buscar = (entrada: string, init?: RequestInit) => Promise<Response>;

async function corpoDeRevisoes(resposta: Response, onde: string): Promise<readonly Revisao[]> {
  if (!resposta.ok) {
    throw new ErroRemoto(`${onde}: o remoto respondeu ${resposta.status}`);
  }
  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    throw new ErroRemoto(`${onde}: o remoto não devolveu JSON`);
  }
  const revisoes = (corpo as { revisoes?: unknown } | null)?.revisoes;
  return parseLog(revisoes ?? [], `${onde}: revisoes`);
}

/**
 * Remoto sobre um endpoint JSON simples.
 *
 * `GET <url>` devolve `{ "revisoes": [...] }`; `POST <url>` recebe o mesmo
 * formato e devolve a união já guardada. Nenhum cabeçalho especial, nenhuma
 * autenticação — autenticação está fora de escopo pela §3.
 */
export function remotoHttp(url: string, buscar: Buscar = fetch): Remoto {
  const chamar = async (onde: string, init?: RequestInit): Promise<readonly Revisao[]> => {
    let resposta: Response;
    try {
      resposta = init === undefined ? await buscar(url) : await buscar(url, init);
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      throw new ErroRemoto(`${onde}: o remoto está inacessível (${motivo})`);
    }
    return corpoDeRevisoes(resposta, onde);
  };

  return {
    descricao: url,
    puxar: () => chamar('puxar'),
    empurrar: (log) =>
      chamar('empurrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisoes: log }),
      }),
  };
}
