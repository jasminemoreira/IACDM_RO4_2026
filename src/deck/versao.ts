import type { Deck } from './tipos.js';

/**
 * Identidade estável do conteúdo de um deck.
 *
 * O formato da §5 não tem campo de versão e está congelado, então a versão é
 * derivada do próprio conteúdo: qualquer alteração em qualquer campo de qualquer
 * cartão produz uma versão diferente. É isso que permite detectar uma troca de
 * versão do deck e disparar a migração do progresso.
 */
export function versaoDoDeck(cartoes: Deck): string {
  const canonico = cartoes.map((c) => `${c.id}${c.hanzi}${c.pinyin}${c.gloss}`).join('');
  return `${cartoes.length}-${fnv1a32(canonico)}`;
}

/** FNV-1a de 32 bits, em hexadecimal. Não é criptográfico — só precisa ser estável. */
function fnv1a32(texto: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
