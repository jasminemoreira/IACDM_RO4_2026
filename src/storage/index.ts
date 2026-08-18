/** Ponto de entrada do módulo `storage`: modelo persistido, migração e depósito local. */
export type { DeckPersistido, EstadoPersistido, Migracao } from './modelo.js';
export {
  ErroModeloIncompativel,
  MIGRACOES,
  VERSAO_MODELO,
  aplicarMigracoes,
  parseEstadoPersistido,
} from './modelo.js';
export type { RelatorioMigracao } from './migracao.js';
export { migrarParaDeck } from './migracao.js';
export type { Deposito } from './deposito.js';
export { depositoIndexedDb, depositoMemoria, depositoPadrao } from './deposito.js';
export type { ProgressoAberto } from './repositorio.js';
export {
  CHAVE_ATUAL,
  CHAVE_DISPOSITIVO,
  abrirProgresso,
  gravarLog,
  identificarDispositivo,
  progressoDe,
} from './repositorio.js';
