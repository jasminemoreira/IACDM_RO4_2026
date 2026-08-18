import { describe, expect, it } from 'vitest';
import { carregarDeck } from '../deck/index.js';
import { MS_POR_DIA } from '../scheduler/index.js';
import { iniciarSessao, registrarNota, responder } from '../session/index.js';
import {
  CHAVE_ATUAL,
  abrirProgresso,
  depositoMemoria,
  gravarProgresso,
  progressoDe,
} from './index.js';
import type { Deposito } from './index.js';

const T0 = Date.UTC(2026, 0, 1);
const v1 = carregarDeck('exemplo');
const v2 = carregarDeck('exemplo-v2');

describe('abrirProgresso', () => {
  it('inicializa e grava na primeira abertura', async () => {
    const deposito = depositoMemoria();
    const { estado, relatorio, aviso } = await abrirProgresso(deposito, v1, T0);

    expect(aviso).toBeNull();
    expect(relatorio.houveTroca).toBe(false);
    expect(estado.progresso).toHaveLength(12);
    expect(await deposito.ler(CHAVE_ATUAL)).not.toBeNull();
  });

  it('recupera o progresso gravado numa abertura seguinte', async () => {
    const deposito = depositoMemoria();
    const primeira = await abrirProgresso(deposito, v1, T0);

    const progresso = registrarNota(progressoDe(primeira.estado), 'c001', 5, T0);
    await gravarProgresso(deposito, primeira.estado, progresso, T0);

    const segunda = await abrirProgresso(deposito, v1, T0 + 1000);
    const c001 = segunda.estado.progresso.find((e) => e.cartaoId === 'c001');
    expect(c001?.n).toBe(1);
    expect(c001?.proximaRevisao).toBe(T0 + MS_POR_DIA);
  });

  it('migra o progresso quando o deck troca de versão entre duas aberturas', async () => {
    const deposito = depositoMemoria();
    const primeira = await abrirProgresso(deposito, v1, T0);
    await gravarProgresso(
      deposito,
      primeira.estado,
      registrarNota(progressoDe(primeira.estado), 'c011', 4, T0),
      T0,
    );

    const naV2 = await abrirProgresso(deposito, v2, T0 + MS_POR_DIA);

    expect(naV2.relatorio.houveTroca).toBe(true);
    expect(naV2.relatorio.arquivados).toEqual(['c011']);
    expect(naV2.estado.orfaos.find((e) => e.cartaoId === 'c011')?.n).toBe(1);
    expect(naV2.estado.deck.versao).toBe(v2.versao);
  });

  it('preserva à parte um registro ilegível em vez de descartá-lo', async () => {
    const corrompido = { versaoModelo: 1, deck: { id: 'x' }, progresso: 'nada disso' };
    const deposito = depositoMemoria(new Map([[CHAVE_ATUAL, corrompido]]));

    const { estado, aviso } = await abrirProgresso(deposito, v1, T0);

    expect(aviso).toMatch(/preservado à parte/);
    expect(estado.progresso).toHaveLength(12);
    expect(await deposito.ler(`ilegivel:${T0}`)).toEqual(corrompido);
  });

  it('preserva registro de um modelo mais novo que o suportado', async () => {
    const futuro = { versaoModelo: 99, progresso: [] };
    const deposito = depositoMemoria(new Map([[CHAVE_ATUAL, futuro]]));

    const { aviso } = await abrirProgresso(deposito, v1, T0);

    expect(aviso).toMatch(/mais nova que a suportada/);
    expect(await deposito.ler(`ilegivel:${T0}`)).toEqual(futuro);
  });
});

describe('gravarProgresso', () => {
  it('preserva os órfãos e o deck vigente ao gravar', async () => {
    const deposito = depositoMemoria();
    const primeira = await abrirProgresso(deposito, v1, T0);
    await gravarProgresso(
      deposito,
      primeira.estado,
      registrarNota(progressoDe(primeira.estado), 'c011', 5, T0),
      T0,
    );
    const naV2 = await abrirProgresso(deposito, v2, T0);

    const depois = await gravarProgresso(
      deposito,
      naV2.estado,
      registrarNota(progressoDe(naV2.estado), 'c013', 5, T0),
      T0 + 5,
    );

    expect(depois.orfaos.map((e) => e.cartaoId)).toEqual(['c011']);
    expect(depois.deck.versao).toBe(v2.versao);
    expect(depois.atualizadoEm).toBe(T0 + 5);
  });
});

describe('sessão através de uma recarga', () => {
  it('uma sessão parcial sobrevive: os cartões já revisados não voltam', async () => {
    const deposito: Deposito = depositoMemoria();

    // primeira "visita": responde três cartões e grava
    const primeira = await abrirProgresso(deposito, v1, T0);
    let sessao = iniciarSessao(v1.cartoes, progressoDe(primeira.estado), T0);
    for (let i = 0; i < 3; i += 1) sessao = responder(sessao, 5, T0);
    await gravarProgresso(deposito, primeira.estado, sessao.progresso, T0);

    // "recarga": estado vem do depósito, não da memória anterior
    const segunda = await abrirProgresso(deposito, v1, T0 + 1000);
    const retomada = iniciarSessao(v1.cartoes, progressoDe(segunda.estado), T0 + 1000);

    expect(retomada.fila).toHaveLength(9);
    expect(retomada.fila).not.toContain('c001');
    expect(retomada.fila[0]).toBe('c004');
  });
});
