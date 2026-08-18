import { describe, expect, it } from 'vitest';
import { carregarDeck } from '../deck/index.js';
import type { DeckIdentificado } from '../deck/index.js';
import { MS_POR_DIA } from '../scheduler/index.js';
import { migrarParaDeck } from '../storage/index.js';
import type { EstadoApp } from './estado.js';
import {
  avisoDeMigracao,
  comAviso,
  comConexao,
  iniciar,
  reiniciar,
  responder,
  revelar,
  telaDe,
  visaoDe,
} from './estado.js';

const T0 = Date.UTC(2026, 0, 1);
const v1 = carregarDeck('exemplo');
const v2 = carregarDeck('exemplo-v2');

function novoEstado(deck: DeckIdentificado = v1, agora = T0): EstadoApp {
  return iniciar({ deck, persistido: migrarParaDeck(null, deck, agora).estado, agora });
}

describe('visaoDe', () => {
  it('mostra o primeiro cartão escondido', () => {
    expect(visaoDe(novoEstado())).toMatchObject({
      tipo: 'revisao',
      revelado: false,
      respondidos: 0,
      total: 12,
    });
  });

  it('revela a resposta sem trocar de cartão', () => {
    const revelada = visaoDe(revelar(novoEstado()));
    expect(revelada).toMatchObject({ tipo: 'revisao', revelado: true });
    if (revelada.tipo === 'revisao') expect(revelada.cartao.pinyin).toBe('nǐ hǎo');
  });

  it('esconde a resposta de novo ao avançar', () => {
    const visao = visaoDe(responder(revelar(novoEstado()), 4, T0));
    expect(visao).toMatchObject({ tipo: 'revisao', revelado: false, respondidos: 1 });
    if (visao.tipo === 'revisao') expect(visao.cartao.id).toBe('c002');
  });

  it('mostra o resumo ao fim da sessão', () => {
    let estado = novoEstado();
    for (let i = 0; i < 12; i += 1) estado = responder(estado, i === 0 ? 5 : 3, T0);

    const visao = visaoDe(estado);
    expect(visao.tipo).toBe('fim');
    if (visao.tipo === 'fim') {
      expect(visao.respostas).toHaveLength(12);
      expect(visao.respostas[0]).toEqual({
        cartaoId: 'c001',
        hanzi: '你好',
        gloss: 'hello',
        q: 5,
        intervaloDias: 1,
      });
    }
  });

  it('avisa quando não há nada devido e informa o próximo prazo', () => {
    let estado = novoEstado();
    for (let i = 0; i < 12; i += 1) estado = responder(estado, 5, T0);

    expect(visaoDe(reiniciar(estado, T0))).toEqual({
      tipo: 'nada-devido',
      proximaRevisao: T0 + MS_POR_DIA,
    });
  });
});

describe('reiniciar', () => {
  it('abre nova sessão preservando o progresso acumulado', () => {
    let estado = novoEstado();
    for (let i = 0; i < 12; i += 1) estado = responder(estado, 5, T0);

    const amanha = reiniciar(estado, T0 + MS_POR_DIA);
    expect(amanha.sessao.fila).toHaveLength(12);
    expect(amanha.sessao.respostas).toEqual([]);
    expect(visaoDe(amanha)).toMatchObject({ tipo: 'revisao', respondidos: 0 });
  });
});

describe('telaDe', () => {
  it('oferece os decks do catálogo com o corrente marcado', () => {
    const tela = telaDe(novoEstado(v2));
    expect(tela.decks).toEqual([
      { id: 'exemplo', rotulo: 'HSK básico', selecionado: false },
      { id: 'exemplo-v2', rotulo: 'HSK básico revisado', selecionado: true },
    ]);
  });

  it('reflete aviso e conexão', () => {
    const estado = comConexao(comAviso(novoEstado(), 'algo aconteceu'), true);
    expect(telaDe(estado)).toMatchObject({ aviso: 'algo aconteceu', offline: true });
    expect(telaDe(comAviso(estado, null)).aviso).toBeNull();
  });

  it('marca a ausência de persistência', () => {
    const estado = iniciar({
      deck: v1,
      persistido: migrarParaDeck(null, v1, T0).estado,
      agora: T0,
      persistente: false,
    });
    expect(telaDe(estado).persistente).toBe(false);
  });
});

describe('avisoDeMigracao', () => {
  it('cala quando não houve troca de versão', () => {
    expect(avisoDeMigracao(migrarParaDeck(null, v1, T0).relatorio)).toBeNull();
  });

  it('resume o que a troca de versão fez com o progresso', () => {
    const anterior = migrarParaDeck(null, v1, T0).estado;
    const aviso = avisoDeMigracao(migrarParaDeck(anterior, v2, T0).relatorio);

    expect(aviso).toContain('11 com progresso preservado');
    expect(aviso).toContain('2 novo(s)');
    expect(aviso).toContain('1 arquivado(s) sem perda');
  });
});
