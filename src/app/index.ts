import { DECK_PADRAO, carregarDeck } from '../deck/index.js';
import { CAMINHO_SYNC, registrarServiceWorker } from '../pwa/index.js';
import { ehNota } from '../scheduler/index.js';
import {
  abrirProgresso,
  depositoPadrao,
  gravarLog,
  identificarDispositivo,
} from '../storage/index.js';
import type { Deposito } from '../storage/index.js';
import { ErroRemoto, remotoHttp, sincronizar as reconciliar } from '../sync/index.js';
import type { Remoto } from '../sync/index.js';
import { renderizar } from '../ui/index.js';
import type { Acoes } from '../ui/index.js';
import type { EstadoApp } from './estado.js';
import {
  aplicarSync,
  avisoDeMigracao,
  comAviso,
  comConexao,
  comPersistido,
  falhaDeSync,
  iniciar,
  reiniciar,
  responder,
  revelar,
  sincronizando,
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
  sincronizar: () => {},
};

async function montar(raiz: HTMLElement, deposito: Deposito, remoto: Remoto): Promise<void> {
  let estado: EstadoApp;
  const dispositivo = await identificarDispositivo(deposito);

  /** Carrega um deck do catálogo e migra o progresso guardado para ele. */
  async function abrir(deckId: string, avisoAnterior: string | null = null): Promise<EstadoApp> {
    const deck = carregarDeck(deckId);
    const aberto = await abrirProgresso(deposito, deck, agora());
    const avisos = [avisoAnterior, aberto.aviso, avisoDeMigracao(aberto.relatorio)].filter(
      (a): a is string => typeof a === 'string' && a !== '',
    );
    return iniciar({
      deck,
      dispositivo,
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
      const atualizado = await gravarLog(
        deposito,
        estado.persistido,
        estado.persistido.log,
        agora(),
      );
      estado = comPersistido(estado, atualizado);
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      aplicar(comAviso(estado, `o progresso não pôde ser gravado (${motivo})`));
    }
  }

  /**
   * Reconcilia com o remoto e grava o resultado.
   *
   * Falha de rede não é excepcional aqui — a aplicação é offline-first —, então
   * vira uma linha de estado no cabeçalho, não um erro que interrompe o estudo.
   */
  async function sincronizarAgora(): Promise<void> {
    if (estado.sync.situacao === 'sincronizando') return;
    aplicar(sincronizando(estado));

    try {
      const resultado = await reconciliar(remoto, estado.persistido.log, agora());
      aplicar(aplicarSync(estado, resultado, agora()));
      await persistir();
    } catch (erro) {
      const motivo =
        erro instanceof ErroRemoto || erro instanceof Error ? erro.message : String(erro);
      aplicar(falhaDeSync(estado, motivo));
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
    sincronizar: () => void sincronizarAgora(),
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
    addEventListener(evento, () => {
      aplicar(comConexao(estado, !navigator.onLine));
      if (evento === 'online') void sincronizarAgora();
    });
  }

  estado = await abrir(deckPedido());
  desenhar();

  // sincroniza de saída: é o que faz um dispositivo que acabou de abrir
  // encontrar o que o outro registrou enquanto ele estava offline
  if (navigator.onLine) void sincronizarAgora();
}

// O worker só existe no build de produção; em desenvolvimento não há o que registrar.
if (import.meta.env.PROD) void registrarServiceWorker();

const raiz = document.getElementById('app');
if (raiz === null) throw new Error('elemento #app não encontrado');

montar(raiz, depositoPadrao(), remotoHttp(CAMINHO_SYNC)).catch((erro: unknown) => {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  renderizar(
    raiz,
    {
      visao: { tipo: 'erro', mensagem },
      decks: [],
      aviso: null,
      offline: !navigator.onLine,
      persistente: false,
      sync: { situacao: 'ociosa', detalhe: null },
    },
    acoesInertes,
  );
});
