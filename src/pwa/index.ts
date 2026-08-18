/**
 * Ponto de entrada do módulo `pwa`: registro do service worker e as decisões
 * da estratégia de cache. O worker em si (`sw.ts`) é um segundo ponto de
 * entrada do build e não é importado pela aplicação.
 */
export type { Pedido, Rota } from './estrategia.js';
export { CASCA, PREFIXO_CACHE, cachesObsoletos, nomeDoCache, rotaDe } from './estrategia.js';
export { CAMINHO_SW, registrarServiceWorker } from './registro.js';
