import type { DeckIdentificado } from '../deck/index.js';
import type { Progresso } from '../session/index.js';
import type { Revisao } from '../sync/index.js';
import { projetar } from '../sync/index.js';
import type { Deposito } from './deposito.js';
import type { RelatorioMigracao } from './migracao.js';
import { migrarParaDeck } from './migracao.js';
import type { EstadoPersistido } from './modelo.js';
import { VERSAO_MODELO, parseEstadoPersistido } from './modelo.js';

export const CHAVE_ATUAL = 'atual';
export const CHAVE_DISPOSITIVO = 'dispositivo';
const PREFIXO_ILEGIVEL = 'ilegivel:';

/** Resultado da abertura do progresso local. */
export interface ProgressoAberto {
  readonly estado: EstadoPersistido;
  readonly relatorio: RelatorioMigracao;
  /** Preenchido quando havia um registro local que não pôde ser lido. */
  readonly aviso: string | null;
}

/** Identificador curto e estável desta instalação. */
function novoIdentificador(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
}

/**
 * O identificador deste dispositivo, criado na primeira abertura e guardado.
 *
 * Vive fora do registro de conteúdo porque é propriedade da instalação, não do
 * deck: trocar de deck não deve trocar a identidade que assina as revisões.
 */
export async function identificarDispositivo(
  deposito: Deposito,
  gerar: () => string = novoIdentificador,
): Promise<string> {
  const guardado = await deposito.ler(CHAVE_DISPOSITIVO);
  if (typeof guardado === 'string' && guardado !== '') return guardado;

  const novo = gerar();
  await deposito.escrever(CHAVE_DISPOSITIVO, novo);
  return novo;
}

/** O progresso projetado sobre o deck vigente, na forma que a sessão consome. */
export function progressoDe(estado: EstadoPersistido): Progresso {
  return projetar(estado.base, estado.log, estado.deck.cartoes);
}

/**
 * Lê o registro local, migra-o para o deck vigente e grava o resultado.
 *
 * Um registro ilegível — modelo mais novo, dado corrompido — **não é descartado**:
 * ele é copiado para uma chave `ilegivel:<instante>` antes de a aplicação começar
 * do zero, e o chamador recebe um aviso para exibir.
 */
export async function abrirProgresso(
  deposito: Deposito,
  deck: DeckIdentificado,
  agora: number,
): Promise<ProgressoAberto> {
  const bruto = await deposito.ler(CHAVE_ATUAL);

  let anterior: EstadoPersistido | null = null;
  let aviso: string | null = null;

  if (bruto !== null) {
    try {
      anterior = parseEstadoPersistido(bruto);
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      await deposito.escrever(`${PREFIXO_ILEGIVEL}${agora}`, bruto);
      aviso = `o progresso local não pôde ser lido (${motivo}) e foi preservado à parte`;
    }
  }

  const { estado, relatorio } = migrarParaDeck(anterior, deck, agora);
  if (estado !== anterior) await deposito.escrever(CHAVE_ATUAL, estado);

  return { estado, relatorio, aviso };
}

/** Grava um log de revisões preservando o deck vigente e o estado herdado. */
export async function gravarLog(
  deposito: Deposito,
  base: EstadoPersistido,
  log: readonly Revisao[],
  agora: number,
): Promise<EstadoPersistido> {
  const atualizado: EstadoPersistido = {
    versaoModelo: VERSAO_MODELO,
    deck: base.deck,
    base: base.base,
    log,
    atualizadoEm: agora,
  };

  await deposito.escrever(CHAVE_ATUAL, atualizado);
  return atualizado;
}
