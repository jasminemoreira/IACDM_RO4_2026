import { describe, expect, it } from 'vitest';
import { PREFIXO_CACHE, cachesObsoletos, nomeDoCache, rotaDe } from './estrategia.js';

const ORIGEM = 'https://hanzi.exemplo';
const pedido = (url: string, metodo = 'GET', navegacao = false) => ({ url, metodo, navegacao });

describe('rotaDe', () => {
  it('manda toda navegação para a casca', () => {
    expect(rotaDe(pedido(`${ORIGEM}/`, 'GET', true), ORIGEM)).toBe('casca');
    expect(rotaDe(pedido(`${ORIGEM}/?deck=exemplo-v2`, 'GET', true), ORIGEM)).toBe('casca');
  });

  it('serve recursos da própria origem pelo cache', () => {
    expect(rotaDe(pedido(`${ORIGEM}/assets/index.js`), ORIGEM)).toBe('cache');
    expect(rotaDe(pedido(`${ORIGEM}/favicon.svg`), ORIGEM)).toBe('cache');
  });

  it('não cacheia outra origem', () => {
    expect(rotaDe(pedido('https://outro.exemplo/dados.json'), ORIGEM)).toBe('rede');
  });

  it('não cacheia método diferente de GET', () => {
    expect(rotaDe(pedido(`${ORIGEM}/sync`, 'POST'), ORIGEM)).toBe('rede');
    expect(rotaDe(pedido(`${ORIGEM}/sync`, 'PUT'), ORIGEM)).toBe('rede');
  });

  it('POST de navegação também vai à rede', () => {
    expect(rotaDe(pedido(`${ORIGEM}/`, 'POST', true), ORIGEM)).toBe('rede');
  });

  it('url inválida vai à rede em vez de quebrar', () => {
    expect(rotaDe(pedido('nao é uma url'), ORIGEM)).toBe('rede');
  });
});

describe('cachesObsoletos', () => {
  it('elege os caches de builds anteriores', () => {
    const atual = nomeDoCache('abc123');
    const nomes = [nomeDoCache('antigo'), atual, 'outro-app-v1'];

    expect(cachesObsoletos(nomes, atual)).toEqual([nomeDoCache('antigo')]);
  });

  it('não toca em caches de outras aplicações', () => {
    expect(cachesObsoletos(['workbox-precache', 'imagens'], nomeDoCache('x'))).toEqual([]);
  });

  it('nomeia o cache com o prefixo da aplicação', () => {
    expect(nomeDoCache('v9')).toBe(`${PREFIXO_CACHE}v9`);
  });
});
