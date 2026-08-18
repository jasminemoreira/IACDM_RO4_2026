/**
 * ui — o casco e a tela de revisão. Não depende de nada (ARQ-01: o ciclo com `app`
 * foi cortado; aqui só entram view model e callbacks).
 *
 * SEC-03: só `textContent`. Nunca `innerHTML` — o deck é entrada, e a origem que o
 * renderiza é a mesma que guarda o log.
 * UX-05: os elementos são criados uma vez em `mount`; `render` só atualiza texto e
 * estado, para não perder o foco de teclado no gesto que se repete a sessão inteira.
 */

/** UX-01: a escala publicada por Woźniak. Sem isto, a nota — única entrada do
 *  algoritmo — vira palpite, e o agendamento inteiro se corrompe. */
export const ESCALA: readonly { q: 0 | 1 | 2 | 3 | 4 | 5; rotulo: string; ajuda: string }[] = [
  { q: 0, rotulo: "0", ajuda: "branco total" },
  { q: 1, rotulo: "1", ajuda: "errei; lembrei ao ver" },
  { q: 2, rotulo: "2", ajuda: "errei; parecia fácil" },
  { q: 3, rotulo: "3", ajuda: "acertei com dificuldade séria" },
  { q: 4, rotulo: "4", ajuda: "acertei com hesitação" },
  { q: 5, rotulo: "5", ajuda: "acertei sem hesitar" },
];

/** UX-06: no máximo UMA faixa por vez, nesta ordem de precedência.
 *  "sessão vazia" não disputa a faixa — é uma TELA. */
export type Faixa =
  | { readonly tipo: "volatil" }
  | { readonly tipo: "novaVersao" }
  | { readonly tipo: "erro"; readonly texto: string }
  | { readonly tipo: "sincronizacao"; readonly texto: string };

export const PRECEDENCIA_FAIXA = ["volatil", "novaVersao", "erro", "sincronizacao"] as const;

export function faixaVisivel(candidatas: readonly Faixa[]): Faixa | null {
  for (const tipo of PRECEDENCIA_FAIXA) {
    const achada = candidatas.find((f) => f.tipo === tipo);
    if (achada) return achada;
  }
  return null;
}

export type ViewModel =
  | { readonly tela: "carregando" }
  | { readonly tela: "erro"; readonly titulo: string; readonly detalhe: string }
  | {
      readonly tela: "vazia";
      readonly proximoVencimento: number | null;
      readonly totalCartoes: number;
      readonly faixa: Faixa | null;
    }
  | {
      readonly tela: "revisao";
      readonly hanzi: string;
      readonly pinyin: string;
      readonly gloss: string;
      readonly revelado: boolean;
      readonly restantes: number;
      readonly total: number;
      readonly faixa: Faixa | null;
    };

export type Handlers = {
  readonly onRevelar: () => void;
  readonly onNota: (q: 0 | 1 | 2 | 3 | 4 | 5) => void;
  readonly onSincronizar?: () => void;
  readonly onRecarregar?: () => void;
};

type Elementos = {
  faixa: HTMLDivElement;
  faixaTexto: HTMLSpanElement;
  faixaAcao: HTMLButtonElement;
  progresso: HTMLDivElement;
  cartao: HTMLDivElement;
  hanzi: HTMLDivElement;
  pinyin: HTMLDivElement;
  gloss: HTMLDivElement;
  revelar: HTMLButtonElement;
  notas: HTMLDivElement;
  botoesNota: HTMLButtonElement[];
  vazia: HTMLDivElement;
  vaziaTexto: HTMLParagraphElement;
  erro: HTMLDivElement;
  erroTitulo: HTMLHeadingElement;
  erroDetalhe: HTMLParagraphElement;
  sincronizar: HTMLButtonElement;
};

let el: Elementos | null = null;
let handlers: Handlers | null = null;

function criar<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe: string,
  pai: HTMLElement,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  n.className = classe;
  pai.appendChild(n);
  return n;
}

export function mount(root: HTMLElement, h: Handlers): void {
  handlers = h;
  root.textContent = "";

  const faixa = criar("div", "faixa oculto", root);
  const faixaTexto = criar("span", "faixa-texto", faixa);
  const faixaAcao = criar("button", "faixa-acao oculto", faixa);
  faixaAcao.type = "button";

  const progresso = criar("div", "progresso", root);

  const cartao = criar("div", "cartao oculto", root);
  const hanzi = criar("div", "hanzi", cartao);
  const pinyin = criar("div", "pinyin oculto", cartao);
  const gloss = criar("div", "gloss oculto", cartao);

  const revelar = criar("button", "revelar", cartao);
  revelar.type = "button";
  revelar.textContent = "Revelar";
  revelar.addEventListener("click", () => handlers?.onRevelar());

  const notas = criar("div", "notas oculto", cartao);
  const botoesNota = ESCALA.map(({ q, rotulo, ajuda }) => {
    const b = criar("button", "nota", notas);
    b.type = "button";
    b.textContent = rotulo;
    b.title = ajuda;
    b.setAttribute("aria-label", `nota ${q}: ${ajuda}`);
    const legenda = criar("span", "nota-ajuda", b);
    legenda.textContent = ajuda;
    b.addEventListener("click", () => handlers?.onNota(q));
    return b;
  });

  const vazia = criar("div", "vazia oculto", root);
  const vaziaTitulo = criar("h2", "vazia-titulo", vazia);
  vaziaTitulo.textContent = "Nada devido agora";
  const vaziaTexto = criar("p", "vazia-texto", vazia);

  const erro = criar("div", "erro oculto", root);
  const erroTitulo = criar("h2", "erro-titulo", erro);
  const erroDetalhe = criar("p", "erro-detalhe", erro);

  const sincronizar = criar("button", "sincronizar oculto", root);
  sincronizar.type = "button";
  sincronizar.textContent = "Sincronizar";
  sincronizar.addEventListener("click", () => handlers?.onSincronizar?.());

  faixaAcao.addEventListener("click", () => handlers?.onRecarregar?.());

  // UX-04: o gesto se repete dezenas de vezes por sessão; teclado não é enfeite.
  document.addEventListener("keydown", (ev) => {
    if (ev.repeat) return;
    if (ev.key === " " || ev.key === "Enter") {
      if (!revelar.classList.contains("oculto")) {
        ev.preventDefault();
        handlers?.onRevelar();
      }
      return;
    }
    const n = Number(ev.key);
    if (Number.isInteger(n) && n >= 0 && n <= 5 && !notas.classList.contains("oculto")) {
      ev.preventDefault();
      handlers?.onNota(n as 0 | 1 | 2 | 3 | 4 | 5);
    }
  });

  el = {
    faixa, faixaTexto, faixaAcao, progresso, cartao, hanzi, pinyin, gloss,
    revelar, notas, botoesNota, vazia, vaziaTexto, erro, erroTitulo, erroDetalhe, sincronizar,
  };
}

function mostrar(n: HTMLElement, visivel: boolean): void {
  n.classList.toggle("oculto", !visivel);
}

const TEXTO_FAIXA: Record<Faixa["tipo"], (f: Faixa) => string> = {
  volatil: () => "O progresso NÃO será salvo: o armazenamento do navegador não está disponível.",
  novaVersao: () => "Há uma versão nova. Recarregue quando quiser — a atual segue funcionando.",
  erro: (f) => (f.tipo === "erro" ? f.texto : ""),
  sincronizacao: (f) => (f.tipo === "sincronizacao" ? f.texto : ""),
};

export function render(vm: ViewModel): void {
  if (!el) throw new Error("render antes de mount");

  const faixa = "faixa" in vm ? vm.faixa : null;
  mostrar(el.faixa, faixa !== null);
  if (faixa) {
    el.faixa.dataset["tipo"] = faixa.tipo;
    el.faixaTexto.textContent = TEXTO_FAIXA[faixa.tipo](faixa);
    mostrar(el.faixaAcao, faixa.tipo === "novaVersao");
    el.faixaAcao.textContent = "Recarregar";
  }

  mostrar(el.cartao, vm.tela === "revisao");
  mostrar(el.vazia, vm.tela === "vazia");
  mostrar(el.erro, vm.tela === "erro");
  // O botão só existe quando há porta de sincronização — no Incremento 1 não há.
  mostrar(el.sincronizar, handlers?.onSincronizar !== undefined && (vm.tela === "revisao" || vm.tela === "vazia"));
  el.progresso.textContent = "";

  if (vm.tela === "revisao") {
    el.hanzi.textContent = vm.hanzi;
    el.pinyin.textContent = vm.pinyin;
    el.gloss.textContent = vm.gloss;
    mostrar(el.pinyin, vm.revelado);
    mostrar(el.gloss, vm.revelado);
    mostrar(el.revelar, !vm.revelado);
    mostrar(el.notas, vm.revelado);
    el.progresso.textContent = `${vm.total - vm.restantes + 1} de ${vm.total}`;
  } else if (vm.tela === "vazia") {
    el.vaziaTexto.textContent =
      vm.proximoVencimento === null
        ? `Nenhum dos ${vm.totalCartoes} cartões está devido.`
        : `Nenhum dos ${vm.totalCartoes} cartões está devido. O próximo vence em ${new Date(vm.proximoVencimento).toLocaleString()}.`;
  } else if (vm.tela === "erro") {
    el.erroTitulo.textContent = vm.titulo;
    el.erroDetalhe.textContent = vm.detalhe;
  }
}
