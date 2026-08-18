import type { Deck } from '../deck/index.js';
import { parseDeck } from '../deck/index.js';
import type { EstadoCartao } from '../scheduler/index.js';
import type { Revisao } from '../sync/index.js';
import { parseLog } from '../sync/index.js';

/**
 * Versão do **modelo de conteúdo persistido** — a forma do registro guardado
 * localmente. Independe da versão do *deck*, que é derivada do conteúdo dos
 * cartões.
 *
 * - **1** — guardava a dobra: `progresso` (estado SM-2 por cartão) e `orfaos`.
 * - **2** — guarda os fatos: `log` de revisões, mais `base` com a dobra herdada
 *   da versão 1. O Incremento 3 exigiu a mudança: reconciliar dois dispositivos
 *   sem descartar revisões de um dos lados é impossível a partir da dobra.
 */
export const VERSAO_MODELO = 2;

/** O deck vigente, guardado junto do progresso para detectar troca de versão. */
export interface DeckPersistido {
  readonly id: string;
  readonly versao: string;
  readonly cartoes: Deck;
}

/**
 * O registro local completo.
 *
 * `base` só é não-vazia em instalações que vieram do modelo 1, onde os fatos
 * originais não existem mais; o `log` é a fonte de verdade daí em diante.
 * Nada é apagado numa troca de versão do deck: revisões de cartões que saíram
 * continuam no log, apenas não são projetadas.
 */
export interface EstadoPersistido {
  readonly versaoModelo: number;
  readonly deck: DeckPersistido;
  readonly base: readonly EstadoCartao[];
  readonly log: readonly Revisao[];
  readonly atualizadoEm: number;
}

/** O registro local não pôde ser lido no modelo corrente. */
export class ErroModeloIncompativel extends Error {
  override readonly name = 'ErroModeloIncompativel';
}

/** Uma migração leva o registro da versão `n` para a versão `n + 1`. */
export type Migracao = (registro: Record<string, unknown>) => Record<string, unknown>;

/**
 * Do modelo 1 para o 2: a dobra que a versão 1 guardava vira o estado herdado,
 * e o log de fatos nasce vazio.
 *
 * `progresso` e `orfaos` entram juntos em `base` — a distinção entre eles era
 * "está no deck vigente ou não", que na versão 2 é respondida projetando o log
 * sobre o deck, não guardando duas listas.
 */
const de1Para2: Migracao = (registro) => {
  const progresso = Array.isArray(registro['progresso']) ? registro['progresso'] : [];
  const orfaos = Array.isArray(registro['orfaos']) ? registro['orfaos'] : [];
  const { progresso: _p, orfaos: _o, ...resto } = registro;

  return { ...resto, base: [...progresso, ...orfaos], log: [] };
};

/** Migrações do modelo persistido, indexadas pela versão de origem. */
export const MIGRACOES: ReadonlyMap<number, Migracao> = new Map([[1, de1Para2]]);

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
  if (
    proximaRevisao !== null &&
    (typeof proximaRevisao !== 'number' || !Number.isFinite(proximaRevisao))
  ) {
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

  const base = registro['base'] ?? [];
  if (!Array.isArray(base)) {
    throw new ErroModeloIncompativel('registro local com estado herdado malformado');
  }

  const atualizadoEm = registro['atualizadoEm'];

  return {
    versaoModelo: VERSAO_MODELO,
    deck: {
      id: deck['id'],
      versao: deck['versao'],
      cartoes: parseDeck(deck['cartoes']),
    },
    base: base.map((e, i) => parseEstadoCartao(e, `base[${i}]`)),
    log: parseLog(registro['log'] ?? []),
    atualizadoEm: typeof atualizadoEm === 'number' ? atualizadoEm : 0,
  };
}
