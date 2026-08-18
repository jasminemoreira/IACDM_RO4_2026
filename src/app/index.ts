import deckBruto from '../../decks/exemplo.json';
import { parseDeck } from '../deck/index.js';
import { ehNota } from '../scheduler/index.js';
import { progressoInicial } from '../session/index.js';
import { renderizar } from '../ui/index.js';
import type { Acoes, Visao } from '../ui/index.js';
import type { EstadoApp } from './estado.js';
import { iniciar, reiniciar, responder, revelar, visaoDe } from './estado.js';

const agora = (): number => Date.now();

function montar(raiz: HTMLElement): void {
  let estado: EstadoApp;
  try {
    const deck = parseDeck(deckBruto);
    estado = iniciar(deck, progressoInicial(deck), agora());
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    renderizar(raiz, { tipo: 'erro', mensagem } satisfies Visao, acoesInertes);
    return;
  }

  const acoes: Acoes = {
    revelar: () => aplicar(revelar(estado)),
    responder: (q) => aplicar(responder(estado, q, agora())),
    reiniciar: () => aplicar(reiniciar(estado, agora())),
  };

  function aplicar(proximo: EstadoApp): void {
    estado = proximo;
    renderizar(raiz, visaoDe(estado), acoes);
  }

  document.addEventListener('keydown', (evento) => {
    if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
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

  aplicar(estado);
}

const acoesInertes: Acoes = { revelar: () => {}, responder: () => {}, reiniciar: () => {} };

const raiz = document.getElementById('app');
if (raiz === null) throw new Error('elemento #app não encontrado');
montar(raiz);
