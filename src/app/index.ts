import { DECK_PADRAO, carregarDeck } from '../deck/index.js';
import { registrarServiceWorker } from '../pwa/index.js';
import { ehNota } from '../scheduler/index.js';
import { abrirProgresso, depositoPadrao, gravarProgresso } from '../storage/index.js';
import type { Deposito } from '../storage/index.js';
import { renderizar } from '../ui/index.js';
import type { Acoes } from '../ui/index.js';
import type { EstadoApp } from './estado.js';
import {
  avisoDeMigracao,
  comAviso,
  comConexao,
  comPersistido,
  iniciar,
  reiniciar,
  responder,
  revelar,
  telaDe,
  visaoDe,
} from './estado.js';

const agora = (): number => Date.now();

const PARAMETRO_DECK = 'deck';

function deckPedido(): string {
  return new URLSearchParams(location.search).get(PARAMETRO_DECK) ?? DECK_PADRAO;
}

function anotarDeckNaUrl(id: string): void {
  const url = new URL(location.href);
  if (id === DECK_PADRAO) url.searchParams.delete(PARAMETRO_DECK);
  else url.searchParams.set(PARAMETRO_DECK, id);
  history.replaceState(null, '', url);
}

const acoesInertes: Acoes = {
  revelar: () => {},
  responder: () => {},
  reiniciar: () => {},
  dispensarAviso: () => {},
  trocarDeck: () => {},
};

async function montar(raiz: HTMLElement, deposito: Deposito): Promise<void> {
  let estado: EstadoApp;

  /** Carrega um deck do catálogo e migra o progresso guardado para ele. */
  async function abrir(deckId: string, avisoAnterior: string | null = null): Promise<EstadoApp> {
    const deck = carregarDeck(deckId);
    const aberto = await abrirProgresso(deposito, deck, agora());
    const avisos = [avisoAnterior, aberto.aviso, avisoDeMigracao(aberto.relatorio)].filter(
      (a): a is string => typeof a === 'string' && a !== '',
    );
    return iniciar({
      deck,
      persistido: aberto.estado,
      agora: agora(),
      aviso: avisos.length > 0 ? avisos.join(' ') : null,
      offline: !navigator.onLine,
      persistente: deposito.persistente,
    });
  }

  function desenhar(): void {
    renderizar(raiz, telaDe(estado), acoes);
  }

  function aplicar(proximo: EstadoApp): void {
    estado = proximo;
    desenhar();
  }

  /** Grava o progresso da sessão. Falha de gravação vira aviso, não perda de tela. */
  async function persistir(): Promise<void> {
    try {
      const atualizado = await gravarProgresso(
        deposito,
        estado.persistido,
        estado.sessao.progresso,
        agora(),
      );
      estado = comPersistido(estado, atualizado);
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      aplicar(comAviso(estado, `o progresso não pôde ser gravado (${motivo})`));
    }
  }

  const acoes: Acoes = {
    revelar: () => aplicar(revelar(estado)),
    responder: (q) => {
      aplicar(responder(estado, q, agora()));
      void persistir();
    },
    reiniciar: () => aplicar(reiniciar(estado, agora())),
    dispensarAviso: () => aplicar(comAviso(estado, null)),
    trocarDeck: (id) => {
      anotarDeckNaUrl(id);
      void abrir(id).then(aplicar);
    },
  };

  document.addEventListener('keydown', (evento) => {
    if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
    if (evento.target instanceof HTMLSelectElement) return;

    const visao = visaoDe(estado);
    if (visao.tipo !== 'revisao') return;

    if (!visao.revelado && (evento.key === ' ' || evento.key === 'Enter')) {
      evento.preventDefault();
      acoes.revelar();
      return;
    }
    const q = Number(evento.key);
    if (visao.revelado && evento.key.length === 1 && ehNota(q)) {
      evento.preventDefault();
      acoes.responder(q);
    }
  });

  for (const evento of ['online', 'offline'] as const) {
    addEventListener(evento, () => aplicar(comConexao(estado, !navigator.onLine)));
  }

  estado = await abrir(deckPedido());
  desenhar();
}

// O worker só existe no build de produção; em desenvolvimento não há o que registrar.
if (import.meta.env.PROD) void registrarServiceWorker();

const raiz = document.getElementById('app');
if (raiz === null) throw new Error('elemento #app não encontrado');

montar(raiz, depositoPadrao()).catch((erro: unknown) => {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  renderizar(
    raiz,
    {
      visao: { tipo: 'erro', mensagem },
      decks: [],
      aviso: null,
      offline: !navigator.onLine,
      persistente: false,
    },
    acoesInertes,
  );
});
