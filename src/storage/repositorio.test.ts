import { describe, expect, it } from 'vitest';
import { carregarDeck } from '../deck/index.js';
import { MS_POR_DIA } from '../scheduler/index.js';
import { iniciarSessao, responder } from '../session/index.js';
import { novaRevisao } from '../sync/index.js';
import type { Revisao } from '../sync/index.js';
import {
  CHAVE_ATUAL,
  CHAVE_DISPOSITIVO,
  abrirProgresso,
  depositoMemoria,
  gravarLog,
  identificarDispositivo,
  progressoDe,
} from './index.js';
import type { Deposito } from './index.js';

const T0 = Date.UTC(2026, 0, 1);
const v1 = carregarDeck('exemplo');
const v2 = carregarDeck('exemplo-v2');

/** Registra uma nota no log, como a aplicação faz a cada resposta. */
function anotar(log: readonly Revisao[], cartaoId: string, q: 0 | 5, em: number): Revisao[] {
  return [...log, novaRevisao(log, 'disp', cartaoId, q, em)];
}

describe('identificarDispositivo', () => {
  it('cria e guarda um identificador na primeira vez', async () => {
    const deposito = depositoMemoria();
    const id = await identificarDispositivo(deposito, () => 'abc12345');

    expect(id).toBe('abc12345');
    expect(await deposito.ler(CHAVE_DISPOSITIVO)).toBe('abc12345');
  });

  it('reaproveita o identificador guardado', async () => {
    const deposito = depositoMemoria(new Map([[CHAVE_DISPOSITIVO, 'ja-existe']]));
    expect(await identificarDispositivo(deposito, () => 'outro')).toBe('ja-existe');
  });

  it('não é afetado por troca de deck', async () => {
    const deposito = depositoMemoria();
    const antes = await identificarDispositivo(deposito, () => 'estavel1');
    await abrirProgresso(deposito, v1, T0);
    await abrirProgresso(deposito, v2, T0 + 1);

    expect(await identificarDispositivo(deposito, () => 'outro')).toBe(antes);
  });
});

describe('abrirProgresso', () => {
  it('inicializa e grava na primeira abertura', async () => {
    const deposito = depositoMemoria();
    const { estado, relatorio, aviso } = await abrirProgresso(deposito, v1, T0);

    expect(aviso).toBeNull();
    expect(relatorio.houveTroca).toBe(false);
    expect(estado.log).toEqual([]);
    expect(progressoDe(estado).size).toBe(12);
    expect(await deposito.ler(CHAVE_ATUAL)).not.toBeNull();
  });

  it('recupera o progresso gravado numa abertura seguinte', async () => {
    const deposito = depositoMemoria();
    const primeira = await abrirProgresso(deposito, v1, T0);
    await gravarLog(deposito, primeira.estado, anotar(primeira.estado.log, 'c001', 5, T0), T0);

    const segunda = await abrirProgresso(deposito, v1, T0 + 1000);
    const c001 = progressoDe(segunda.estado).get('c001');

    expect(c001?.n).toBe(1);
    expect(c001?.proximaRevisao).toBe(T0 + MS_POR_DIA);
  });

  it('migra o progresso quando o deck troca de versão entre duas aberturas', async () => {
    const deposito = depositoMemoria();
    const primeira = await abrirProgresso(deposito, v1, T0);
    await gravarLog(deposito, primeira.estado, anotar(primeira.estado.log, 'c011', 5, T0), T0);

    const naV2 = await abrirProgresso(deposito, v2, T0 + MS_POR_DIA);

    expect(naV2.relatorio.houveTroca).toBe(true);
    expect(naV2.relatorio.arquivados).toEqual(['c011']);
    expect(naV2.estado.log.some((r) => r.cartaoId === 'c011')).toBe(true);
    expect(naV2.estado.deck.versao).toBe(v2.versao);
  });

  it('lê um registro gravado no modelo 1 e o migra', async () => {
    const registroV1 = {
      versaoModelo: 1,
      deck: { id: v1.id, versao: v1.versao, cartoes: v1.cartoes },
      progresso: [{ cartaoId: 'c001', n: 2, ef: 2.7, intervaloDias: 6, proximaRevisao: T0 }],
      orfaos: [],
      atualizadoEm: T0,
    };
    const deposito = depositoMemoria(new Map([[CHAVE_ATUAL, registroV1]]));

    const { estado, aviso } = await abrirProgresso(deposito, v1, T0 + 1);

    expect(aviso).toBeNull();
    expect(estado.versaoModelo).toBe(2);
    expect(progressoDe(estado).get('c001')?.n).toBe(2);
  });

  it('preserva à parte um registro ilegível em vez de descartá-lo', async () => {
    const corrompido = { versaoModelo: 2, deck: { id: 'x' }, log: 'nada disso' };
    const deposito = depositoMemoria(new Map([[CHAVE_ATUAL, corrompido]]));

    const { estado, aviso } = await abrirProgresso(deposito, v1, T0);

    expect(aviso).toMatch(/preservado à parte/);
    expect(estado.log).toEqual([]);
    expect(await deposito.ler(`ilegivel:${T0}`)).toEqual(corrompido);
  });

  it('preserva registro de um modelo mais novo que o suportado', async () => {
    const futuro = { versaoModelo: 99, log: [] };
    const deposito = depositoMemoria(new Map([[CHAVE_ATUAL, futuro]]));

    const { aviso } = await abrirProgresso(deposito, v1, T0);

    expect(aviso).toMatch(/mais nova que a suportada/);
    expect(await deposito.ler(`ilegivel:${T0}`)).toEqual(futuro);
  });
});

describe('gravarLog', () => {
  it('preserva o deck vigente e o estado herdado ao gravar', async () => {
    const deposito = depositoMemoria();
    const primeira = await abrirProgresso(deposito, v1, T0);
    await gravarLog(deposito, primeira.estado, anotar(primeira.estado.log, 'c011', 5, T0), T0);
    const naV2 = await abrirProgresso(deposito, v2, T0);

    const depois = await gravarLog(
      deposito,
      naV2.estado,
      anotar(naV2.estado.log, 'c013', 5, T0 + 1),
      T0 + 5,
    );

    expect(depois.deck.versao).toBe(v2.versao);
    expect(depois.log.map((r) => r.cartaoId)).toEqual(['c011', 'c013']);
    expect(depois.atualizadoEm).toBe(T0 + 5);
  });
});

describe('sessão através de uma recarga', () => {
  it('uma sessão parcial sobrevive: os cartões já revisados não voltam', async () => {
    const deposito: Deposito = depositoMemoria();

    // primeira "visita": responde três cartões e grava
    const primeira = await abrirProgresso(deposito, v1, T0);
    let sessao = iniciarSessao(v1.cartoes, progressoDe(primeira.estado), T0);
    let log = primeira.estado.log;
    for (let i = 0; i < 3; i += 1) {
      const cartaoId = sessao.fila[sessao.indice]!;
      log = anotar(log, cartaoId, 5, T0 + i);
      sessao = responder(sessao, 5, T0 + i);
    }
    await gravarLog(deposito, primeira.estado, log, T0 + 10);

    // "recarga": estado vem do depósito, não da memória anterior
    const segunda = await abrirProgresso(deposito, v1, T0 + 1000);
    const projetado = progressoDe(segunda.estado);
    const retomada = iniciarSessao(v1.cartoes, projetado, T0 + 1000);

    expect(projetado).toEqual(sessao.progresso);
    expect(retomada.fila).toHaveLength(9);
    expect(retomada.fila).not.toContain('c001');
    expect(retomada.fila[0]).toBe('c004');
  });
});
