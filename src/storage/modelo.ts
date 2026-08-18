import type { Deck } from '../deck/index.js';
import { parseDeck } from '../deck/index.js';
import type { EstadoCartao } from '../scheduler/index.js';

/**
 * Versão do **modelo de conteúdo persistido** — a forma do registro guardado
 * localmente. Independe da versão do *deck*, que é derivada do conteúdo dos
 * cartões. Ao mudar a forma deste registro, incremente aqui e registre a
 * migração correspondente em `MIGRACOES`.
 */
export const VERSAO_MODELO = 1;

/** O deck vigente, guardado junto do progresso para detectar troca de versão. */
export interface DeckPersistido {
  readonly id: string;
  readonly versao: string;
  readonly cartoes: Deck;
}

/**
 * O registro local completo.
 *
 * `orfaos` guarda o progresso de cartões que não estão no deck vigente. Nada é
 * apagado numa troca de versão: o que sai do deck é arquivado aqui e volta
 * intacto se o cartão reaparecer.
 */
export interface EstadoPersistido {
  readonly versaoModelo: number;
  readonly deck: DeckPersistido;
  readonly progresso: readonly EstadoCartao[];
  readonly orfaos: readonly EstadoCartao[];
  readonly atualizadoEm: number;
}

/** O registro local não pôde ser lido no modelo corrente. */
export class ErroModeloIncompativel extends Error {
  override readonly name = 'ErroModeloIncompativel';
}

/** Uma migração leva o registro da versão `n` para a versão `n + 1`. */
export type Migracao = (registro: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrações do modelo persistido, indexadas pela versão de origem.
 *
 * Vazio enquanto só existiu a versão 1. Ao criar a versão 2, registre aqui
 * `[1, (r) => ...]` — a cadeia é aplicada automaticamente na leitura.
 */
export const MIGRACOES: ReadonlyMap<number, Migracao> = new Map();

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Sobe um registro bruto até `VERSAO_MODELO`, aplicando a cadeia de migrações.
 *
 * Falha alto em vez de descartar: um registro que não sabemos ler é preservado
 * no depósito e a aplicação avisa, para que nenhum progresso se perca em silêncio.
 */
export function aplicarMigracoes(
  bruto: unknown,
  migracoes: ReadonlyMap<number, Migracao> = MIGRACOES,
  alvo: number = VERSAO_MODELO,
): Record<string, unknown> {
  if (!ehRegistro(bruto)) {
    throw new ErroModeloIncompativel('registro local não é um objeto');
  }

  const versao = bruto['versaoModelo'];
  if (typeof versao !== 'number' || !Number.isInteger(versao) || versao < 1) {
    throw new ErroModeloIncompativel('registro local sem versão de modelo válida');
  }
  if (versao > alvo) {
    throw new ErroModeloIncompativel(
      `registro local na versão ${versao}, mais nova que a suportada (${alvo})`,
    );
  }

  let registro = bruto;
  for (let v = versao; v < alvo; v += 1) {
    const migracao = migracoes.get(v);
    if (migracao === undefined) {
      throw new ErroModeloIncompativel(`sem migração do modelo ${v} para ${v + 1}`);
    }
    registro = { ...migracao(registro), versaoModelo: v + 1 };
  }
  return registro;
}

function parseEstadoCartao(bruto: unknown, onde: string): EstadoCartao {
  if (!ehRegistro(bruto)) throw new ErroModeloIncompativel(`${onde}: estado não é um objeto`);

  const { cartaoId, n, ef, intervaloDias, proximaRevisao } = bruto;
  if (typeof cartaoId !== 'string' || cartaoId === '') {
    throw new ErroModeloIncompativel(`${onde}: cartaoId inválido`);
  }
  for (const [campo, valor] of [
    ['n', n],
    ['ef', ef],
    ['intervaloDias', intervaloDias],
  ] as const) {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      throw new ErroModeloIncompativel(`${onde}: campo "${campo}" inválido`);
    }
  }
  if (proximaRevisao !== null && (typeof proximaRevisao !== 'number' || !Number.isFinite(proximaRevisao))) {
    throw new ErroModeloIncompativel(`${onde}: proximaRevisao inválida`);
  }

  return {
    cartaoId,
    n: n as number,
    ef: ef as number,
    intervaloDias: intervaloDias as number,
    proximaRevisao: proximaRevisao as number | null,
  };
}

/** Valida um registro já migrado e o converte em `EstadoPersistido`. */
export function parseEstadoPersistido(bruto: unknown): EstadoPersistido {
  const registro = aplicarMigracoes(bruto);

  const deck = registro['deck'];
  if (!ehRegistro(deck) || typeof deck['id'] !== 'string' || typeof deck['versao'] !== 'string') {
    throw new ErroModeloIncompativel('registro local sem deck identificado');
  }

  const progresso = registro['progresso'];
  const orfaos = registro['orfaos'] ?? [];
  if (!Array.isArray(progresso) || !Array.isArray(orfaos)) {
    throw new ErroModeloIncompativel('registro local com progresso malformado');
  }

  const atualizadoEm = registro['atualizadoEm'];

  return {
    versaoModelo: VERSAO_MODELO,
    deck: {
      id: deck['id'],
      versao: deck['versao'],
      cartoes: parseDeck(deck['cartoes']),
    },
    progresso: progresso.map((e, i) => parseEstadoCartao(e, `progresso[${i}]`)),
    orfaos: orfaos.map((e, i) => parseEstadoCartao(e, `orfaos[${i}]`)),
    atualizadoEm: typeof atualizadoEm === 'number' ? atualizadoEm : 0,
  };
}
