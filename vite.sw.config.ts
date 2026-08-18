import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import { ARQUIVO_PRECACHE } from './vite.config.js';

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
 * Injeta no worker a lista de arquivos do build da aplicação e a versão de
 * cache derivada dela. Falha o build se a lista não existir ou se os
 * marcadores não forem encontrados — um precache vazio publicado em silêncio
 * seria pior do que não publicar.
 */
function injetarPrecache(): Plugin {
  return {
    name: 'hanzi-precache-sw',
    enforce: 'post',
    generateBundle(_opcoes, bundle) {
      let arquivos: string[];
      try {
        arquivos = JSON.parse(readFileSync(ARQUIVO_PRECACHE, 'utf8')) as string[];
      } catch {
        this.error(`${ARQUIVO_PRECACHE} não encontrado: rode o build da aplicação antes`);
        return;
      }

      const worker = bundle[ARQUIVO_SW];
      if (worker === undefined || worker.type !== 'chunk') {
        this.error(`${ARQUIVO_SW} não foi emitido`);
        return;
      }
      if (worker.imports.length > 0) {
        this.error(
          `${ARQUIVO_SW} ficou com imports (${worker.imports.join(', ')}): ` +
            'um service worker clássico não carrega módulos',
        );
        return;
      }

      const antes = worker.code;
      worker.code = worker.code
        .replace(/(["'])__PRECACHE__\1/, JSON.stringify(JSON.stringify(arquivos)))
        .replace(/(["'])__VERSAO_CACHE__\1/, JSON.stringify(hash(arquivos.join('\n'))));

      if (worker.code === antes) this.error('marcadores de precache não encontrados em sw.ts');
    },
  };
}

/**
 * O service worker é construído à parte, e não como um segundo ponto de entrada
 * do build da aplicação.
 *
 * O motivo é concreto: num build único, qualquer módulo importado tanto pelo
 * worker quanto pela aplicação vira um *chunk* compartilhado, e o `sw.js`
 * passa a começar com `import` — que um worker clássico não carrega. Com um
 * build próprio o grafo do worker é fechado por construção, e o plugin ainda
 * verifica que nenhum import sobrou.
 */
export default defineConfig({
  plugins: [injetarPrecache()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: { sw: 'src/pwa/sw.ts' },
      output: { entryFileNames: ARQUIVO_SW, inlineDynamicImports: true },
    },
  },
});
