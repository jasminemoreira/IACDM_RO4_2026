import type { Acoes, Tela, Visao } from './visao.js';
import { ESCALA_NOTAS } from './notas.js';

function elemento(tag: string, classe?: string, texto?: string): HTMLElement {
  const el = document.createElement(tag);
  if (classe !== undefined) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function botao(rotulo: string, classe: string, aoClicar: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = classe;
  b.textContent = rotulo;
  b.addEventListener('click', aoClicar);
  return b;
}

function dias(n: number): string {
  return n === 1 ? '1 dia' : `${n} dias`;
}

function cabecalho(tela: Tela, acoes: Acoes): HTMLElement {
  const barra = elemento('header', 'cabecalho');

  const seletor = document.createElement('select');
  seletor.className = 'cabecalho__decks';
  seletor.setAttribute('aria-label', 'deck de estudo');
  for (const opcao of tela.decks) {
    const item = document.createElement('option');
    item.value = opcao.id;
    item.textContent = opcao.rotulo;
    item.selected = opcao.selecionado;
    seletor.append(item);
  }
  seletor.addEventListener('change', () => acoes.trocarDeck(seletor.value));
  barra.append(seletor);

  const marcas = elemento('div', 'cabecalho__marcas');
  if (tela.offline) marcas.append(elemento('span', 'marca marca--offline', 'offline'));
  if (!tela.persistente) marcas.append(elemento('span', 'marca marca--alerta', 'sem persistência'));

  const sincronizando = tela.sync.situacao === 'sincronizando';
  const botaoSync = botao(sincronizando ? 'sincronizando…' : 'sincronizar', 'sync__botao', () =>
    acoes.sincronizar(),
  );
  botaoSync.disabled = sincronizando;
  marcas.append(botaoSync);
  barra.append(marcas);

  return barra;
}

function faixaDeSync(tela: Tela): HTMLElement | null {
  if (tela.sync.detalhe === null) return null;
  const linha = elemento(
    'p',
    `sync__detalhe${tela.sync.situacao === 'erro' ? ' sync__detalhe--erro' : ''}`,
    tela.sync.detalhe,
  );
  linha.setAttribute('role', 'status');
  return linha;
}

function avisoDe(mensagem: string, acoes: Acoes): HTMLElement {
  const bloco = elemento('div', 'aviso');
  bloco.setAttribute('role', 'status');
  bloco.append(elemento('p', 'aviso__texto', mensagem));
  bloco.append(botao('dispensar', 'aviso__fechar', () => acoes.dispensarAviso()));
  return bloco;
}

function telaRevisao(
  visao: Extract<Visao, { tipo: 'revisao' }>,
  acoes: Acoes,
): readonly HTMLElement[] {
  const barra = elemento('div', 'andamento');
  barra.append(elemento('span', 'andamento__texto', `${visao.respondidos + 1} de ${visao.total}`));
  const trilho = elemento('div', 'andamento__trilho');
  const preenchido = elemento('div', 'andamento__preenchido');
  preenchido.style.width = `${(visao.respondidos / visao.total) * 100}%`;
  trilho.append(preenchido);
  barra.append(trilho);

  const cartao = elemento('section', 'cartao');
  const hanzi = elemento('p', 'cartao__hanzi', visao.cartao.hanzi);
  hanzi.lang = 'zh-Hans'; // deixa o navegador escolher a forma regional certa do glifo
  cartao.append(hanzi);

  if (visao.revelado) {
    cartao.append(
      elemento('p', 'cartao__pinyin', visao.cartao.pinyin),
      elemento('p', 'cartao__gloss', visao.cartao.gloss),
    );
  }

  const acoesEl = elemento('div', 'acoes');
  if (visao.revelado) {
    acoesEl.append(elemento('p', 'acoes__titulo', 'Como foi a lembrança?'));
    const grade = elemento('div', 'notas');
    for (const { q, rotulo } of ESCALA_NOTAS) {
      const b = botao(`${q}`, `nota nota--${q}`, () => acoes.responder(q));
      b.append(elemento('span', 'nota__rotulo', rotulo));
      b.title = `${q} — ${rotulo}`;
      grade.append(b);
    }
    acoesEl.append(grade);
  } else {
    acoesEl.append(botao('Mostrar resposta', 'primario', () => acoes.revelar()));
    acoesEl.append(elemento('p', 'dica', 'espaço para revelar · 0–5 para avaliar'));
  }

  return [barra, cartao, acoesEl];
}

function telaFim(visao: Extract<Visao, { tipo: 'fim' }>, acoes: Acoes): readonly HTMLElement[] {
  const bloco = elemento('section', 'resumo');
  bloco.append(
    elemento('h1', 'resumo__titulo', 'Sessão concluída'),
    elemento(
      'p',
      'resumo__linha',
      `${visao.respostas.length} ${visao.respostas.length === 1 ? 'cartão revisado' : 'cartões revisados'}`,
    ),
  );

  const lista = elemento('ul', 'resumo__lista');
  for (const r of visao.respostas) {
    const item = elemento('li', 'resumo__item');
    const cartao = elemento('span', 'resumo__cartao');
    const hanzi = elemento('span', 'resumo__hanzi', r.hanzi);
    hanzi.lang = 'zh-Hans';
    cartao.append(hanzi, elemento('span', 'resumo__gloss', r.gloss));
    item.append(
      cartao,
      elemento('span', 'resumo__nota', `nota ${r.q}`),
      elemento('span', 'resumo__intervalo', `volta em ${dias(r.intervaloDias)}`),
    );
    lista.append(item);
  }
  bloco.append(lista);
  bloco.append(botao('Nova sessão', 'primario', () => acoes.reiniciar()));
  return [bloco];
}

function telaNadaDevido(
  visao: Extract<Visao, { tipo: 'nada-devido' }>,
  acoes: Acoes,
): readonly HTMLElement[] {
  const bloco = elemento('section', 'resumo');
  bloco.append(elemento('h1', 'resumo__titulo', 'Nada devido agora'));
  bloco.append(
    elemento(
      'p',
      'resumo__linha',
      visao.proximaRevisao === null
        ? 'Não há cartões agendados.'
        : `Próxima revisão em ${new Date(visao.proximaRevisao).toLocaleString('pt-BR')}.`,
    ),
  );
  bloco.append(botao('Verificar de novo', 'primario', () => acoes.reiniciar()));
  return [bloco];
}

function corpo(visao: Visao, acoes: Acoes): readonly HTMLElement[] {
  switch (visao.tipo) {
    case 'revisao':
      return telaRevisao(visao, acoes);
    case 'fim':
      return telaFim(visao, acoes);
    case 'nada-devido':
      return telaNadaDevido(visao, acoes);
    case 'erro': {
      const bloco = elemento('section', 'erro');
      bloco.append(
        elemento('h1', 'resumo__titulo', 'Não foi possível carregar o deck'),
        elemento('p', 'resumo__linha', visao.mensagem),
      );
      return [bloco];
    }
  }
}

/** Desenha a tela inteira dentro de `raiz`, substituindo o conteúdo anterior. */
export function renderizar(raiz: HTMLElement, tela: Tela, acoes: Acoes): void {
  raiz.replaceChildren();
  raiz.append(cabecalho(tela, acoes));

  const sync = faixaDeSync(tela);
  if (sync !== null) raiz.append(sync);
  if (tela.aviso !== null) raiz.append(avisoDe(tela.aviso, acoes));
  raiz.append(...corpo(tela.visao, acoes));
}
