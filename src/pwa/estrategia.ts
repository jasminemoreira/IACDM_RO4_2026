/**
 * Decisões da estratégia de cache, isoladas do *service worker* para poderem
 * ser testadas fora do navegador. A estratégia inteira está descrita no README
 * e implementada em `sw.ts`.
 */

export const PREFIXO_CACHE = 'hanzi-';

/** O documento que responde a qualquer navegação — o *app shell*. */
export const CASCA = '/index.html';

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
 * - `rede`: qualquer outra coisa — outros métodos, outras origens — direto à rede,
 *   sem passar pelo cache. É por aqui que a sincronização do Incremento 3 sairá.
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
  return url.origin === origem ? 'cache' : 'rede';
}

/** Caches de builds anteriores, que a ativação deve apagar. */
export function cachesObsoletos(nomes: readonly string[], atual: string): readonly string[] {
  return nomes.filter((nome) => nome.startsWith(PREFIXO_CACHE) && nome !== atual);
}
