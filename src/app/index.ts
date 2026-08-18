/**
 * app — raiz de composição E laço do caso de uso.
 *
 * IMP-03 / ARQ-06: a ordem é única e imposta pelo tipo — nota produz RASCUNHO,
 * o rascunho vira EVENTO gravado, e só o evento gravado avança a sessão. Renderizar
 * antes de gravar deixou de ser possível sem mentir no tipo.
 *
 * PERF-05: dar nota e sincronizar são mutuamente exclusivos.
 * PRO-02: a versão do deck é conferida no arranque, nunca no meio da sessão.
 */

import { parse, cardById, DeckError, type Deck } from "../deck/index.ts";
import { fold, applyOne, type ReviewEvent } from "../review-log/index.ts";
import { dueAt, type Grade, type SchedulingState } from "../scheduler/index.ts";
import {
  commit, current, grade, isComplete, open, restantes, SessionError,
  type Session, type SessionDraft,
} from "../session/index.ts";
import type { ReviewRepository } from "../storage/index.ts";
import { faixaVisivel, mount, render, type Faixa, type ViewModel } from "../ui/index.ts";

export type SyncReport = {
  readonly enviados: number;
  readonly recebidos: number;
  readonly pendentes: number;
};

export type SyncPort = {
  synchronize(): Promise<SyncReport>;
  state(): "idle" | "running";
};

/** IMP-02: os ports são enumerados. `app` não descobre nada sozinho. */
export type Ports = {
  readonly repo: ReviewRepository;
  /** devolve o JSON cru do deck; lança se não conseguir */
  readonly carregarDeck: () => Promise<unknown>;
  readonly agora: () => number;
  readonly root: HTMLElement;
  /** ausente no Incremento 1 */
  readonly sync?: SyncPort;
  /** ausente no Incremento 1 */
  readonly temNovaVersao?: () => boolean;
  readonly recarregar?: () => void;
  readonly online?: () => boolean;
};

export type Diagnostico = {
  readonly deckVersion: string | null;
  readonly cartoes: number;
  readonly fila: number;
  readonly cursor: number;
  readonly eventos: number;
  readonly pendentes: number;
  readonly maxSseq: number;
  readonly epoch: string | null;
  readonly modoArmazenamento: string;
};

let estadoDiag: Diagnostico | null = null;

/** OBS-01: o quadro que explica "meu cartão não apareceu" sem alterar código. */
export function diag(): Diagnostico | null {
  return estadoDiag;
}

export async function start(ports: Ports): Promise<void> {
  const { repo, root, agora } = ports;

  let deck: Deck;
  try {
    deck = parse(await ports.carregarDeck());
  } catch (erro) {
    // ASS-10 / IMP-07: "primeira carga sem rede" e "deck inválido" são situações
    // diferentes, com saídas diferentes, e o usuário precisa saber qual das duas é.
    const offline = ports.online ? !ports.online() : false;
    render0(root, ports, erro instanceof DeckError
      ? { tela: "erro", titulo: "O deck não pôde ser lido", detalhe: erro.message }
      : offline
        ? { tela: "erro", titulo: "Sem rede na primeira carga", detalhe: "Este aparelho ainda não guardou o app. Conecte-se uma vez e o offline passa a valer." }
        : { tela: "erro", titulo: "Falha ao carregar o deck", detalhe: String((erro as Error)?.message ?? erro) });
    return;
  }

  // PRO-02: conferido AQUI, no arranque, antes de abrir sessão. A migração não move
  // progresso — o log é indexado por id —, então trocar de versão só muda o que está ativo.
  const versaoGuardada = await repo.deckVersion();
  if (versaoGuardada !== deck.version) await repo.setDeckVersion(deck.version);

  let eventos: ReviewEvent[] = await repo.all();
  let estados: Map<string, SchedulingState> = fold(eventos);
  let sessao: Session = open(deck, estados, agora());
  let faixaErro: Faixa | null = null;
  let faixaSync: Faixa | null = null;
  let ocupado = false;

  mount(root, {
    onRevelar: () => {
      if (ocupado || isComplete(sessao)) return;
      sessao = { ...sessao, revelado: true };
      desenhar();
    },
    onNota: (q) => void notar(q),
    ...(ports.sync ? { onSincronizar: () => void sincronizar() } : {}),
    ...(ports.recarregar ? { onRecarregar: ports.recarregar } : {}),
  });

  desenhar();

  /**
   * O laço. A ordem aqui é a garantia de VAL-16 dentro de uma réplica: se o `append`
   * falhar, a sessão NÃO avança e o usuário é avisado de que a nota não foi registrada
   * (PRO-05) — em vez de ver a tela seguir e supor que ficou salva.
   */
  async function notar(q: Grade): Promise<void> {
    if (ocupado || isComplete(sessao) || !sessao.revelado) return;
    ocupado = true;
    let rascunho: SessionDraft;
    try {
      rascunho = grade(sessao, q);
    } catch (erro) {
      ocupado = false;
      if (erro instanceof SessionError) return;
      throw erro;
    }
    try {
      const evento = await repo.append(rascunho);          // aguardado ANTES de avançar
      estados.set(evento.cardId, applyOne(estados.get(evento.cardId), evento));
      eventos.push(evento);
      sessao = commit(sessao, rascunho, evento);
      faixaErro = null;
    } catch (erro) {
      faixaErro = { tipo: "erro", texto: `Nota não registrada: ${String((erro as Error)?.message ?? erro)}. Tente de novo.` };
    } finally {
      ocupado = false;
      desenhar();
    }
  }

  async function sincronizar(): Promise<void> {
    if (ocupado || !ports.sync) return;
    ocupado = true;
    faixaSync = { tipo: "sincronizacao", texto: "Sincronizando…" };
    desenhar();
    try {
      const r = await ports.sync.synchronize();
      eventos = await repo.all();
      estados = fold(eventos);
      // A sessão corrente não é reaberta no meio (A-14); o que chegou vale da próxima.
      faixaSync = { tipo: "sincronizacao", texto: `Sincronizado: ${r.enviados} enviados, ${r.recebidos} recebidos, ${r.pendentes} pendentes.` };
      faixaErro = null;
    } catch (erro) {
      faixaSync = null;
      faixaErro = { tipo: "erro", texto: `Sincronização falhou: ${String((erro as Error)?.message ?? erro)}. As revisões seguem guardadas aqui.` };
    } finally {
      ocupado = false;
      desenhar();
    }
  }

  function faixaAtual(): Faixa | null {
    const candidatas: Faixa[] = [];
    // MEC-05: o modo volátil não pode passar em silêncio.
    if (repo.mode() === "memoria") candidatas.push({ tipo: "volatil" });
    if (ports.temNovaVersao?.()) candidatas.push({ tipo: "novaVersao" });
    if (faixaErro) candidatas.push(faixaErro);
    if (faixaSync) candidatas.push(faixaSync);
    return faixaVisivel(candidatas);   // UX-06: no máximo uma
  }

  function desenhar(): void {
    const faixa = faixaAtual();
    let vm: ViewModel;

    if (isComplete(sessao)) {
      const vencimentos = deck.cards
        .map((c) => estados.get(c.id))
        .filter((s): s is SchedulingState => s !== undefined)
        .map(dueAt)
        .filter((t) => t > agora());
      vm = {
        tela: "vazia",
        proximoVencimento: vencimentos.length > 0 ? Math.min(...vencimentos) : null,
        totalCartoes: deck.cards.length,
        faixa,
      };
    } else {
      const cartao = current(sessao, deck) ?? cardById(deck, sessao.fila[sessao.cursor] ?? "");
      vm = cartao === null
        ? { tela: "erro", titulo: "Cartão ausente", detalhe: "A fila referencia um id que não está no deck." }
        : {
            tela: "revisao",
            hanzi: cartao.hanzi,
            pinyin: cartao.pinyin,
            gloss: cartao.gloss,
            revelado: sessao.revelado,
            restantes: restantes(sessao),
            total: sessao.fila.length,
            faixa,
          };
    }

    render(vm);
    void atualizarDiag();
  }

  async function atualizarDiag(): Promise<void> {
    const h = await repo.health();
    estadoDiag = {
      deckVersion: deck.version,
      cartoes: deck.cards.length,
      fila: sessao.fila.length,
      cursor: sessao.cursor,
      eventos: h.eventos,
      pendentes: h.pendentes,
      maxSseq: h.maxSseq,
      epoch: h.epoch,
      modoArmazenamento: h.modo,
    };
  }
}

function render0(root: HTMLElement, ports: Ports, vm: ViewModel): void {
  mount(root, {
    onRevelar: () => {},
    onNota: () => {},
    ...(ports.recarregar ? { onRecarregar: ports.recarregar } : {}),
  });
  render(vm);
}
