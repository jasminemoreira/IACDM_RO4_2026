import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** Arquivos servidos de `public/`, que não passam pelo grafo do bundle. */
const ESTATICOS = ['/favicon.svg', '/icone-192.png', '/icone-512.png', '/manifest.webmanifest'];

/**
 * Onde o build da aplicação deixa a lista de arquivos para o build do service
 * worker. Fica fora de `dist/` porque não é para ser servido.
 */
export const ARQUIVO_PRECACHE = 'node_modules/.hanzi/precache.json';

const PROXY_SYNC = {
  '/sync': { target: 'http://localhost:5179', changeOrigin: true },
};

/**
 * Anota a lista exata de arquivos deste build para o service worker precachear.
 *
 * A lista não é escrita à mão: nenhum arquivo novo fica de fora e nenhum arquivo
 * removido continua listado. O `sw.js` não entra — um worker não se cacheia.
 */
function anotarPrecache(estaticos: readonly string[]): Plugin {
  return {
    name: 'hanzi-precache',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opcoes, bundle) {
      const arquivos = [
        ...new Set(['/', ...Object.keys(bundle).map((nome) => `/${nome}`), ...estaticos]),
      ].sort();

      mkdirSync(dirname(ARQUIVO_PRECACHE), { recursive: true });
      writeFileSync(ARQUIVO_PRECACHE, JSON.stringify(arquivos, null, 2));
    },
  };
}

export default defineConfig({
  plugins: [anotarPrecache(ESTATICOS)],
  server: { proxy: PROXY_SYNC },
  preview: { proxy: PROXY_SYNC },
  build: { target: 'es2022' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
