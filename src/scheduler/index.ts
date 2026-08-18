/** Ponto de entrada do módulo `scheduler`: SM-2 e seleção de cartões devidos. */
export type { EstadoCartao, Nota } from './tipos.js';
export {
  EF_INICIAL,
  EF_MINIMO,
  MS_POR_DIA,
  NOTA_MINIMA_ACERTO,
  ErroNotaInvalida,
  ehNota,
  estadoInicial,
  revisar,
} from './sm2.js';
export { estaDevido, selecionarDevidos } from './devidos.js';
