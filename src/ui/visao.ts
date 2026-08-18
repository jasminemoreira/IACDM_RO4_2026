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

/** O corpo da tela. */
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

/** Uma opção de deck de entrada oferecida no cabeçalho. */
export interface OpcaoDeck {
  readonly id: string;
  readonly rotulo: string;
  readonly selecionado: boolean;
}

/** Tudo o que a interface desenha: o corpo mais o cabeçalho e os avisos. */
export interface Tela {
  readonly visao: Visao;
  readonly decks: readonly OpcaoDeck[];
  /** Mensagem passageira: migração de deck, falha de gravação, registro ilegível. */
  readonly aviso: string | null;
  readonly offline: boolean;
  /** Falso quando o navegador negou armazenamento e nada será persistido. */
  readonly persistente: boolean;
}

/** Comandos que a interface pode disparar. */
export interface Acoes {
  revelar(): void;
  responder(q: Nota): void;
  reiniciar(): void;
  dispensarAviso(): void;
  trocarDeck(id: string): void;
}
