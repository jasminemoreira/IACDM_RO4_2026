/** Ponto de entrada do módulo `sync`: log de revisões, projeção e reconciliação. */
export type { Revisao } from './revisao.js';
export {
  ErroRevisaoInvalida,
  compararRevisoes,
  novaRevisao,
  ordenar,
  parseLog,
  parseRevisao,
  unir,
} from './revisao.js';
export { contarPorCartao, projetar, revisoesForaDoDeck } from './projecao.js';
