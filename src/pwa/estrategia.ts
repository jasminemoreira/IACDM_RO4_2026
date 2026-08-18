/**
 * Decisões da estratégia de cache, isoladas do *service worker* para poderem
 * ser testadas fora do navegador. A estratégia inteira está descrita no README
 * e implementada em `sw.ts`.
 */

export const PREFIXO_CACHE = 'hanzi-';

/** O documento que responde a qualquer navegação — o *app shell*. */
export const CASCA = '/index.html';

/**
 * Caminho da sincronização. Fica de fora do cache mesmo sendo da própria
 * origem: uma resposta guardada aqui devolveria um log velho e desfaria a
 * reconciliação. Sync é sempre rede, e falha de rede é tratada pela aplicação.
 */
export const CAMINHO_SYNC = '/sync';

export function nomeDoCache(versao: string): string {
  return `${PREFIXO_CACHE}${versao}`;
}

/** Uma requisição reduzida ao que a estratégia precisa saber. */
export interface Pedido {
  readonly metodo: string;
  readonly url: string;
  readonly navegacao: boolean;
}

/**
 * O que fazer com um pedido:
 * - `casca`: navegação, respondida com o documento pré-cacheado;
 * - `cache`: recurso da própria origem, respondido do cache e, se faltar, da rede;
 * - `rede`: qualquer outra coisa — outros métodos, outras origens e a
 *   sincronização — direto à rede, sem passar pelo cache.
 */
export type Rota = 'casca' | 'cache' | 'rede';

export function rotaDe(pedido: Pedido, origem: string): Rota {
  if (pedido.metodo !== 'GET') return 'rede';
  if (pedido.navegacao) return 'casca';

  let url: URL;
  try {
    url = new URL(pedido.url);
  } catch {
    return 'rede';
  }
  if (url.origin !== origem) return 'rede';
  if (url.pathname === CAMINHO_SYNC || url.pathname.startsWith(`${CAMINHO_SYNC}/`)) return 'rede';
  return 'cache';
}

/** Caches de builds anteriores, que a ativação deve apagar. */
export function cachesObsoletos(nomes: readonly string[], atual: string): readonly string[] {
  return nomes.filter((nome) => nome.startsWith(PREFIXO_CACHE) && nome !== atual);
}
