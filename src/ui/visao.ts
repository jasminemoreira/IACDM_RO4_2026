import type { Cartao } from '../deck/index.js';
import type { Nota } from '../scheduler/index.js';

/** Uma linha do resumo de fim de sessão. */
export interface LinhaResumo {
  readonly cartaoId: string;
  readonly hanzi: string;
  readonly gloss: string;
  readonly q: Nota;
  readonly intervaloDias: number;
}

/** O que a interface precisa saber para desenhar a tela. Nada além disto. */
export type Visao =
  | {
      readonly tipo: 'revisao';
      readonly cartao: Cartao;
      readonly revelado: boolean;
      readonly respondidos: number;
      readonly total: number;
    }
  | {
      readonly tipo: 'fim';
      readonly respostas: readonly LinhaResumo[];
    }
  | {
      readonly tipo: 'nada-devido';
      readonly proximaRevisao: number | null;
    }
  | {
      readonly tipo: 'erro';
      readonly mensagem: string;
    };

/** Comandos que a interface pode disparar. */
export interface Acoes {
  revelar(): void;
  responder(q: Nota): void;
  reiniciar(): void;
}
