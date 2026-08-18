import type { Cartao, Deck } from './tipos.js';

/** Falha de formato no deck de entrada. */
export class ErroFormatoDeck extends Error {
  override readonly name = 'ErroFormatoDeck';
}

const CAMPOS = ['id', 'hanzi', 'pinyin', 'gloss'] as const;

function textoNaoVazio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

/**
 * Valida uma entrada desconhecida e a converte em `Deck`.
 * O deck é entrada externa: nada além desta função deve presumir sua forma.
 */
export function parseDeck(entrada: unknown): Deck {
  if (!Array.isArray(entrada)) {
    throw new ErroFormatoDeck('deck deve ser um array de cartões');
  }

  const vistos = new Set<string>();
  const cartoes: Cartao[] = entrada.map((bruto, i) => {
    if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) {
      throw new ErroFormatoDeck(`cartão ${i}: deve ser um objeto`);
    }
    const registro = bruto as Record<string, unknown>;

    for (const campo of CAMPOS) {
      if (!textoNaoVazio(registro[campo])) {
        throw new ErroFormatoDeck(`cartão ${i}: campo "${campo}" ausente ou vazio`);
      }
    }

    const id = registro['id'] as string;
    if (vistos.has(id)) {
      throw new ErroFormatoDeck(`cartão ${i}: id duplicado "${id}"`);
    }
    vistos.add(id);

    return {
      id,
      hanzi: registro['hanzi'] as string,
      pinyin: registro['pinyin'] as string,
      gloss: registro['gloss'] as string,
    };
  });

  if (cartoes.length === 0) {
    throw new ErroFormatoDeck('deck vazio');
  }
  return cartoes;
}

/** Busca um cartão pelo id. Devolve `undefined` se o id não existir no deck. */
export function cartaoPorId(deck: Deck, id: string): Cartao | undefined {
  return deck.find((c) => c.id === id);
}
