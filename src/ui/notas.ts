import type { Nota } from '../scheduler/index.js';

/** Rótulos das notas 0..5 da §4, na ordem em que aparecem na tela. */
export const ESCALA_NOTAS: ReadonlyArray<{ readonly q: Nota; readonly rotulo: string }> = [
  { q: 0, rotulo: 'nenhuma lembrança' },
  { q: 1, rotulo: 'errei, reconheci a resposta' },
  { q: 2, rotulo: 'errei, quase lembrei' },
  { q: 3, rotulo: 'acertei com dificuldade' },
  { q: 4, rotulo: 'acertei com hesitação' },
  { q: 5, rotulo: 'acertei de imediato' },
];
