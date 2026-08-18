import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** Arquivos servidos de `public/`, que não passam pelo grafo do bundle. */
const ESTATICOS = ['/favicon.svg', '/icone-192.png', '/icone-512.png', '/manifest.webmanifest'];

const ARQUIVO_SW = 'sw.js';

/** FNV-1a de 32 bits. Só precisa mudar quando a lista de arquivos muda. */
function hash(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Injeta no service worker a lista exata de arquivos deste build e uma versão
 * de cache derivada dela.
 *
 * É o que mantém o *precache* honesto: a lista não é escrita à mão, então
 * nenhum arquivo novo fica de fora e nenhum arquivo removido continua listado.
 */
function precache(estaticos: readonly string[]): Plugin {
  return {
    name: 'hanzi-precache',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opcoes, bundle) {
      const doBundle = Object.keys(bundle)
        .filter((nome) => nome !== ARQUIVO_SW)
        .map((nome) => `/${nome}`);
      const arquivos = [...new Set(['/', ...doBundle, ...estaticos])].sort();
      const versao = hash(arquivos.join('\n'));

      const worker = bundle[ARQUIVO_SW];
      if (worker === undefined || worker.type !== 'chunk') {
        this.error(`${ARQUIVO_SW} não foi emitido: o precache não pôde ser injetado`);
        return;
      }

      const antes = worker.code;
      worker.code = worker.code
        .replace(/(["'])__PRECACHE__\1/, JSON.stringify(JSON.stringify(arquivos)))
        .replace(/(["'])__VERSAO_CACHE__\1/, JSON.stringify(versao));

      if (worker.code === antes) {
        this.error('marcadores de precache não encontrados em sw.ts');
      }
    },
  };
}

export default defineConfig({
  plugins: [precache(ESTATICOS)],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: { index: 'index.html', sw: 'src/pwa/sw.ts' },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'sw' ? ARQUIVO_SW : 'assets/[name]-[hash].js',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
