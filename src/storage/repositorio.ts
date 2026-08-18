import type { DeckIdentificado } from '../deck/index.js';
import type { EstadoCartao } from '../scheduler/index.js';
import { estadoInicial } from '../scheduler/index.js';
import type { Progresso } from '../session/index.js';
import type { Deposito } from './deposito.js';
import type { RelatorioMigracao } from './migracao.js';
import { migrarParaDeck } from './migracao.js';
import type { EstadoPersistido } from './modelo.js';
import { VERSAO_MODELO, parseEstadoPersistido } from './modelo.js';

export const CHAVE_ATUAL = 'atual';
const PREFIXO_ILEGIVEL = 'ilegivel:';

/** Resultado da abertura do progresso local. */
export interface ProgressoAberto {
  readonly estado: EstadoPersistido;
  readonly relatorio: RelatorioMigracao;
  /** Preenchido quando havia um registro local que não pôde ser lido. */
  readonly aviso: string | null;
}

/** O progresso persistido, na forma que a sessão consome. */
export function progressoDe(estado: EstadoPersistido): Progresso {
  return new Map(estado.progresso.map((e) => [e.cartaoId, e]));
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

/** Grava o progresso corrente preservando o deck vigente e os órfãos arquivados. */
export async function gravarProgresso(
  deposito: Deposito,
  base: EstadoPersistido,
  progresso: Progresso,
  agora: number,
): Promise<EstadoPersistido> {
  const estados: EstadoCartao[] = base.deck.cartoes.map(
    (cartao) => progresso.get(cartao.id) ?? estadoInicial(cartao.id),
  );

  const atualizado: EstadoPersistido = {
    versaoModelo: VERSAO_MODELO,
    deck: base.deck,
    progresso: estados,
    orfaos: base.orfaos,
    atualizadoEm: agora,
  };

  await deposito.escrever(CHAVE_ATUAL, atualizado);
  return atualizado;
}
