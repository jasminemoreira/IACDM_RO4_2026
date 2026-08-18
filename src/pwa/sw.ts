/// <reference lib="webworker" />

/**
 * Service worker da aplicação.
 *
 * Estratégia — *precache* completo do app shell, cache-first, sem revalidação
 * em runtime:
 *
 * 1. **install** — abre o cache do build corrente e guarda todos os arquivos
 *    emitidos pelo build (`ARQUIVOS_PRECACHE`, injetado pelo plugin em
 *    `vite.config.ts`). Depois disso a aplicação inteira está no cache.
 * 2. **activate** — apaga todo cache `hanzi-*` de outro build e assume o
 *    controle das abas abertas.
 * 3. **fetch** — navegação responde sempre `/index.html` do cache; recurso da
 *    mesma origem vem do cache e, só se faltar, da rede; qualquer outra coisa
 *    (outro método, outra origem) vai direto à rede e nunca é cacheada.
 *
 * Consequências assumidas: partida a frio offline funciona, porque nada do app
 * shell depende da rede; e nunca se serve conteúdo obsoleto, porque cada build
 * tem seu próprio cache e o anterior é apagado na ativação.
 */

import { CASCA, cachesObsoletos, nomeDoCache, rotaDe } from './estrategia.js';

/** `self`, com o tipo do escopo de um service worker. */
const sw = self as unknown as ServiceWorkerGlobalScope;

/** Injetados no build pelo plugin `precache` — ver `vite.config.ts`. */
const ARQUIVOS_PRECACHE: readonly string[] = JSON.parse('__PRECACHE__') as string[];
const VERSAO_CACHE = '__VERSAO_CACHE__';

const CACHE = nomeDoCache(VERSAO_CACHE);

sw.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll([...ARQUIVOS_PRECACHE]);
      await sw.skipWaiting();
    })(),
  );
});

sw.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(cachesObsoletos(nomes, CACHE).map((nome) => caches.delete(nome)));
      await sw.clients.claim();
    })(),
  );
});

async function doCache(requisicao: Request, chave: string = requisicao.url): Promise<Response> {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(chave);
  if (guardada !== undefined) return guardada;

  try {
    return await fetch(requisicao);
  } catch {
    return new Response('recurso indisponível offline', {
      status: 503,
      statusText: 'offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

sw.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;
  const rota = rotaDe(
    {
      metodo: requisicao.method,
      url: requisicao.url,
      navegacao: requisicao.mode === 'navigate',
    },
    sw.location.origin,
  );

  if (rota === 'rede') return;
  evento.respondWith(rota === 'casca' ? doCache(requisicao, CASCA) : doCache(requisicao));
});
