import { describe, expect, it } from 'vitest';
import { carregarDeck } from '../deck/index.js';
import type { DeckIdentificado } from '../deck/index.js';
import { MS_POR_DIA } from '../scheduler/index.js';
import { migrarParaDeck } from '../storage/index.js';
import { projetar, remotoMemoria, sincronizar } from '../sync/index.js';
import type { Revisao } from '../sync/index.js';
import type { EstadoApp } from './estado.js';
import {
  aplicarSync,
  avisoDeMigracao,
  comAviso,
  comConexao,
  falhaDeSync,
  iniciar,
  reiniciar,
  responder,
  resumoDeSync,
  revelar,
  sincronizando,
  telaDe,
  visaoDe,
} from './estado.js';

const T0 = Date.UTC(2026, 0, 1);
const v1 = carregarDeck('exemplo');
const v2 = carregarDeck('exemplo-v2');

function novoEstado(deck: DeckIdentificado = v1, agora = T0): EstadoApp {
  return iniciar({
    deck,
    dispositivo: 'disp',
    persistido: migrarParaDeck(null, deck, agora).estado,
    agora,
  });
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
      dispositivo: 'disp',
      persistido: migrarParaDeck(null, v1, T0).estado,
      agora: T0,
      persistente: false,
    });
    expect(telaDe(estado).persistente).toBe(false);
  });
});

describe('registro das revisões no log', () => {
  it('cada nota vira um fato assinado por este dispositivo', () => {
    const estado = responder(responder(novoEstado(), 5, T0), 3, T0 + 1);

    expect(estado.persistido.log).toEqual([
      { id: 'disp-1', dispositivo: 'disp', cartaoId: 'c001', q: 5, em: T0 },
      { id: 'disp-2', dispositivo: 'disp', cartaoId: 'c002', q: 3, em: T0 + 1 },
    ]);
  });

  it('o log dobrado reproduz o progresso da sessão', () => {
    let estado = novoEstado();
    for (const q of [5, 0, 4, 3] as const) estado = responder(estado, q, T0);

    expect(projetar([], estado.persistido.log, v1.cartoes)).toEqual(estado.sessao.progresso);
  });

  it('não registra nada depois do fim da sessão', () => {
    let estado = novoEstado();
    for (let i = 0; i < 12; i += 1) estado = responder(estado, 5, T0);
    const noFim = responder(estado, 5, T0);

    expect(noFim).toBe(estado);
    expect(noFim.persistido.log).toHaveLength(12);
  });
});

describe('sincronização na aplicação', () => {
  /** Revisões que um outro dispositivo registrou sobre os mesmos cartões. */
  const doOutro: readonly Revisao[] = [
    { id: 'outro-1', dispositivo: 'outro', cartaoId: 'c001', q: 2, em: T0 + 5 },
    { id: 'outro-2', dispositivo: 'outro', cartaoId: 'c007', q: 5, em: T0 + 6 },
  ];

  it('marca a interface enquanto sincroniza', () => {
    expect(telaDe(sincronizando(novoEstado())).sync).toEqual({
      situacao: 'sincronizando',
      detalhe: null,
    });
  });

  it('incorpora o log reconciliado e resume o que se moveu', async () => {
    let estado = responder(novoEstado(), 5, T0);
    const remoto = remotoMemoria(doOutro);

    const resultado = await sincronizar(remoto, estado.persistido.log, T0 + 100);
    estado = aplicarSync(estado, resultado, T0 + 100);

    expect(estado.persistido.log.map((r) => r.id)).toEqual(['disp-1', 'outro-1', 'outro-2']);
    expect(telaDe(estado).sync).toEqual({
      situacao: 'ociosa',
      detalhe: 'sincronizado: 2 recebida(s), 1 enviada(s)',
    });
  });

  it('a revisão do outro dispositivo passa a contar no progresso', async () => {
    let estado = responder(novoEstado(), 5, T0);
    const remoto = remotoMemoria(doOutro);

    estado = aplicarSync(
      estado,
      await sincronizar(remoto, estado.persistido.log, T0 + 100),
      T0 + 100,
    );

    // c001: nota 5 daqui em T0, nota 2 do outro em T0+5 — as duas aplicadas
    const c001 = estado.sessao.progresso.get('c001');
    expect(c001?.n).toBe(0);
    expect(c001?.intervaloDias).toBe(1);
    // c007 só o outro revisou
    expect(estado.sessao.progresso.get('c007')?.n).toBe(1);
  });

  it('a sessão reaberta não traz de volta o que este dispositivo já revisou', async () => {
    let estado = novoEstado();
    for (let i = 0; i < 3; i += 1) estado = responder(estado, 5, T0 + i);
    const remoto = remotoMemoria(doOutro);

    estado = aplicarSync(
      estado,
      await sincronizar(remoto, estado.persistido.log, T0 + 100),
      T0 + 100,
    );

    // c001 foi revisado aqui e pelo outro; ambas as notas contam e ele volta a
    // ficar devido, mas c002 e c003, só revisados aqui, não voltam
    expect(estado.sessao.fila).not.toContain('c002');
    expect(estado.sessao.fila).not.toContain('c003');
  });

  it('não perde a revisão local se o remoto falhar', () => {
    const estado = responder(novoEstado(), 5, T0);
    const comFalha = falhaDeSync(estado, 'o remoto está inacessível');

    expect(comFalha.persistido.log).toEqual(estado.persistido.log);
    expect(telaDe(comFalha).sync).toEqual({
      situacao: 'erro',
      detalhe: 'sincronização falhou: o remoto está inacessível',
    });
  });

  it('resume o caso em que nada mudou', () => {
    expect(resumoDeSync({ log: [], recebidas: 0, enviadas: 0, em: T0 })).toBe(
      'sincronizado, nada novo dos dois lados',
    );
  });
});

describe('avisoDeMigracao', () => {
  it('cala quando não houve troca de versão', () => {
    expect(avisoDeMigracao(migrarParaDeck(null, v1, T0).relatorio)).toBeNull();
  });

  it('trata todo cartão como novo quando ainda não há revisão alguma', () => {
    const semHistorico = migrarParaDeck(null, v1, T0).estado;
    const aviso = avisoDeMigracao(migrarParaDeck(semHistorico, v2, T0).relatorio);

    expect(aviso).toContain('0 com progresso preservado');
    expect(aviso).toContain('13 novo(s)');
  });

  it('resume o que a troca de versão fez com o progresso', () => {
    // uma sessão inteira revisada na v1, para que todos os cartões tenham histórico
    let estado = novoEstado();
    for (let i = 0; i < 12; i += 1) estado = responder(estado, 5, T0 + i);

    const aviso = avisoDeMigracao(migrarParaDeck(estado.persistido, v2, T0 + 100).relatorio);

    expect(aviso).toContain('11 com progresso preservado');
    expect(aviso).toContain('2 novo(s)');
    expect(aviso).toContain('1 arquivado(s) sem perda');
  });
});
