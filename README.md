# Hanzi — PWA de revisão espaçada

Implementação do brief em [REQUISITOS.md](REQUISITOS.md). Os requisitos estão congelados;
este documento descreve o que foi construído.

**Estado: os três incrementos entregues.**

## Como rodar

```bash
npm install
npm run dev        # servidor de desenvolvimento (sem service worker)
npm test           # suíte de testes
npm run typecheck  # checagem de tipos da aplicação e do service worker
npm run build      # checagem de tipos + build de produção
npm run preview    # serve o build; é aqui que o service worker existe
npm run remoto     # endpoint JSON da sincronização, em :5179
```

`/sync` é encaminhado para `localhost:5179` tanto em `dev` quanto em `preview`, então
basta manter `npm run remoto` rodando ao lado.

O service worker só é registrado no build de produção — em desenvolvimento ele
atrapalharia o *hot reload* e não há arquivos finais para pré-cachear. Para exercitar o
modo offline, use `npm run build && npm run preview`.

## Estrutura

Módulos são diretórios de primeiro nível sob `src/`, cada um com `index.ts` como único
ponto de entrada. Nenhum módulo importa arquivos internos de outro.

| Módulo | Responsabilidade | Depende de |
| --- | --- | --- |
| `src/deck/` | formato do conteúdo (§5), validação, versão e catálogo de entrada | — |
| `src/scheduler/` | SM-2 (§4) e seleção de cartões devidos | — |
| `src/session/` | laço de revisão e progresso em memória | `deck`, `scheduler` |
| `src/sync/` | log de revisões, projeção SM-2 e reconciliação | `deck`, `scheduler`, `session` |
| `src/storage/` | modelo persistido versionado, migração e depósito local | `deck`, `scheduler`, `session`, `sync` |
| `src/pwa/` | service worker, estratégia de cache e registro | — |
| `src/ui/` | tela e desenho em DOM | `deck`, `scheduler` (só tipos) |
| `src/app/` | composição, estado da aplicação e bootstrap | todos |

Fora de `src/`: [servidor/remoto.mjs](servidor/remoto.mjs) é o endpoint JSON que serve de
armazenamento remoto, sem dependências.

Os decks de entrada ficam em [decks/](decks/), no formato da §5. A aplicação apenas os lê:
não cria nem edita conteúdo.

O fluxo é unidirecional. `src/app/estado.ts` guarda o estado, deriva uma `Tela` e a entrega
a `renderizar`; a `ui` não conhece o domínio nem toca no agendador.

## Incremento 1 — núcleo de revisão

O pseudocódigo da §4 admite duas leituras, fixadas assim — ambas cobertas por teste:

1. **O novo intervalo usa o `EF` anterior.** A linha `I = round(I_anterior * EF)` precede a
   atualização de `EF` no pseudocódigo, então é o `EF` de antes que entra no cálculo.
2. **`EF` é atualizado nos dois ramos**, acerto e erro, porque a linha está fora do `se`.

Outras decisões:

3. **A fila da sessão é fixada no início.** `iniciarSessao` calcula os cartões devidos
   naquele instante e cada um é respondido uma única vez, o que garante que toda sessão
   termina. Um cartão com `q < 3` **não** reentra na fila da sessão corrente: o próprio SM-2
   já o reagenda para o dia seguinte (`I = 1`).
4. **Cartão nunca revisado tem `proximaRevisao = null`** e está devido desde sempre. A ordem
   da fila é determinística: novos primeiro, depois prazo mais antigo, desempate por id.
5. **Todo o estado é imutável.** `revisar`, `responder` e afins devolvem novos valores.
6. **Nota inválida é erro, não silêncio.** `revisar` rejeita `q` fora de 0..5 inteiro, assim
   como `parseDeck` rejeita deck malformado.

| Critério de aceitação | Onde está |
| --- | --- |
| o agendador apresenta apenas os cartões devidos | `src/scheduler/devidos.ts`, `src/session/sessao.ts` |
| `q` é registrada e o intervalo recomputado conforme a §4 | `src/scheduler/sm2.ts` |
| uma sessão pode ser concluída do início ao fim | `src/session/sessao.ts` |

## Incremento 2 — offline e persistência

### Estratégia de cache — declarada

O service worker está em [src/pwa/sw.ts](src/pwa/sw.ts); as decisões de rota, isoladas para
teste, em [src/pwa/estrategia.ts](src/pwa/estrategia.ts).

**Precache completo do app shell, cache-first, sem revalidação em runtime.**

| Evento | Comportamento |
| --- | --- |
| `install` | abre o cache `hanzi-<versão-do-build>` e guarda **todos** os arquivos emitidos pelo build. Depois disso a aplicação inteira está no disco. Em seguida `skipWaiting()`. |
| `activate` | apaga todo cache `hanzi-*` que não seja o deste build e chama `clients.claim()`. |
| `fetch` — navegação | responde sempre `/index.html` do cache. É isto que faz a partida a frio offline funcionar, inclusive com `?deck=…` na URL. |
| `fetch` — GET de mesma origem | cache primeiro; só se faltar, rede; se a rede também falhar, `503`. |
| `fetch` — `/sync` | **nunca** é cacheado, mesmo sendo da própria origem: uma resposta guardada devolveria um log velho e desfaria a reconciliação. |
| `fetch` — resto | outro método ou outra origem vai direto à rede, sem cache. |

A lista de precache **não é escrita à mão**: o build da aplicação a anota a partir do bundle
real e o build do worker a injeta, derivando dela a versão do cache. Um arquivo novo entra
sozinho; um removido sai sozinho; e cada build tem seu próprio cache, então nunca se serve
conteúdo obsoleto. Se a lista faltar, ou os marcadores não forem encontrados, **o build
falha** em vez de publicar um precache vazio.

O worker é construído por [vite.sw.config.ts](vite.sw.config.ts), separado do build da
aplicação. O motivo é concreto: num build único, qualquer módulo importado pelos dois vira
um *chunk* compartilhado e o `sw.js` passa a começar com `import`, que um service worker
clássico não carrega. Com build próprio o grafo do worker é fechado por construção, e o
plugin ainda verifica que nenhum import sobrou.

O conteúdo dos decks é empacotado no bundle, não buscado em runtime — offline não há
requisição alguma a fazer além da sincronização, que é opcional.

### Persistência

`IndexedDB` (banco `hanzi`, loja `estado`), com queda para um depósito em memória quando o
navegador nega armazenamento — nesse caso a interface mostra a marca *sem persistência* em
vez de fingir que gravou. O progresso é gravado após cada nota.

### Modelo de conteúdo versionado

São **duas versões independentes**, e vale distinguir:

- **`versaoModelo`** — a forma do registro guardado localmente, em `src/storage/modelo.ts`.
  Ao mudar essa forma, incrementa-se `VERSAO_MODELO` e registra-se a migração em `MIGRACOES`;
  `aplicarMigracoes` encadeia os degraus na leitura, um por vez, e falha alto se faltar um.
  - **versão 1** — guardava a dobra: o estado SM-2 por cartão, mais uma lista de órfãos.
  - **versão 2** — guarda os fatos: o `log` de revisões, mais `base` com a dobra herdada da
    versão 1. O Incremento 3 forçou a mudança (ver abaixo), e a migração 1→2 está implementada
    e testada: `progresso` e `orfaos` viram `base`, o log nasce vazio, nada se perde.
- **`versao` do deck** — derivada do conteúdo dos cartões, porque a §5 está congelada e não
  tem campo de versão. Qualquer alteração em qualquer campo produz uma versão nova, o que é
  o que permite detectar a troca.

**Troca de versão do deck** (`src/storage/migracao.ts`), pela identidade `id` da §5:

| Situação | O que acontece |
| --- | --- |
| cartão continua no deck | mantém o estado SM-2, mesmo se hanzi/pinyin/gloss mudaram |
| cartão novo no deck | não tem revisão no log, começa devido |
| cartão sai do deck | **as revisões dele continuam no log**, apenas deixam de ser projetadas |
| cartão volta ao deck | reaparece com todo o histórico aplicado |

Um registro local **ilegível** — corrompido, ou de um modelo mais novo que o suportado — não
é descartado: é copiado para a chave `ilegivel:<instante>` e a aplicação avisa na tela antes
de começar do zero.

Limite assumido: se o `id` de um cartão muda entre versões, ele é outro cartão. Não há como
reconciliar isso sem inventar conteúdo, e o histórico antigo fica guardado em vez de perdido.

### Cenário reproduzível da migração

```bash
npm run build && npm run preview
```

1. Abra `/` e responda os 11 primeiros cartões da fila — o 11º é `c011`.
2. No seletor do cabeçalho, escolha **HSK básico revisado** (ou abra `/?deck=exemplo-v2`).
3. O aviso informa: *10 com progresso preservado, 3 novo(s), 1 arquivado(s) sem perda*.
   `c011` sai do deck, `c013` e `c014` entram, `c003` muda de *gloss* mas mantém o progresso.
4. Volte para **HSK básico**: `c011` reaparece com o mesmo `n`, `EF` e prazo de antes.

| Critério de aceitação | Onde está |
| --- | --- |
| service worker registrado, com estratégia de cache declarada por escrito | `src/pwa/`, e a tabela acima |
| partida a frio **offline** funciona | precache do app shell + navegação servida da casca |
| deck e progresso persistem localmente e sobrevivem a recarga | `src/storage/`, IndexedDB |
| troca de versão do deck migra o progresso sem perda | `src/storage/migracao.ts` |

## Incremento 3 — sincronização com conflito

### Por que o modelo mudou

O critério *"nenhum dos dois lados perde revisões já registradas"* não é satisfazível
guardando apenas o estado SM-2. O estado é uma **dobra** sobre um histórico: se A revisou um
cartão duas vezes e B uma vez, ambos offline, qualquer regra que escolha um dos dois estados
descarta as revisões do outro, e não há como recuperá-las a partir da dobra.

Então o que se persiste e se sincroniza é o **fato**, não a dobra:

```ts
interface Revisao {
  id: string;          // <dispositivo>-<sequência>, identidade global do fato
  dispositivo: string;
  cartaoId: string;
  q: Nota;
  em: number;          // quando a revisão aconteceu
}
```

O progresso é `projetar(base, log, deck)`: parte do estado herdado e aplica as revisões na
ordem total. Há um teste que fixa o invariante central — **dobrar o log reproduz exatamente
o progresso que o laço de sessão calculou**, então as duas contas nunca divergem.

### A resolução de conflito — definida

> **O resultado é a união dos dois conjuntos de revisões, aplicada na ordem total
> `(instante, id)`.**

Não há vencedor e não há descarte. Duas revisões concorrentes do mesmo cartão são **ambas**
aplicadas, como se tivessem acontecido em sequência num único dispositivo, e o estado SM-2 é
recalculado dobrando o log unido. O desempate por `id` existe porque dois relógios podem
marcar o mesmo milissegundo; sem ele a ordem não seria total e os dispositivos poderiam
divergir.

Daí saem três propriedades, todas cobertas por teste:

- **nada se perde** — toda revisão registrada de qualquer lado está no resultado;
- **convergência** — os dois lados terminam com o mesmo log e o mesmo progresso, e a ordem
  em que sincronizam não muda o resultado, porque a união é comutativa e associativa;
- **idempotência** — sincronizar de novo, sem revisões novas, não muda nada.

Duas consequências assumidas, e não escondidas:

1. Quem sincroniza primeiro só fica sabendo do outro **na sincronização seguinte**. Isso é
   inerente a um protocolo *pull/push*: convergência significa "cada dispositivo converge
   assim que sincroniza depois de o outro ter empurrado".
2. Uma revisão antiga que chega tarde é aplicada na sua posição de tempo, o que pode alterar
   o intervalo já calculado para revisões posteriores daquele cartão. É o preço de não
   descartar nada — e é exatamente o que o incremento pede.

### O remoto

`GET /sync` devolve `{ "revisoes": [...] }`; `POST /sync` recebe o mesmo formato e devolve a
união já guardada; `DELETE /sync` esvazia (só para reiniciar cenários).

O servidor é **deliberadamente burro**: guarda um conjunto de revisões indexado por `id` e
não resolve conflito nenhum. Toda a reconciliação está no cliente. Ele valida o formato de
cada revisão para que um cliente quebrado não envenene os outros, e nunca remove nem
sobrescreve um fato já guardado.

Não há bloqueio nem número de versão: como a união é comutativa e idempotente, duas escritas
concorrentes convergem sem coordenação. `sincronizar` ainda une a resposta do `POST` ao que
já tinha, para incorporar o que um terceiro dispositivo tenha escrito entre o `GET` e o `POST`.

`src/sync/remoto.ts` traz duas implementações do mesmo contrato: `remotoHttp` e
`remotoMemoria` — o duplo local que o brief permite, usado nos testes.

A aplicação sincroniza sozinha ao abrir e ao reconectar, além do botão no cabeçalho. Falha de
rede não interrompe o estudo: vira uma linha de estado no cabeçalho, porque estar offline é
o caso normal e não uma exceção.

### Cenário reproduzível do conflito

```bash
npm run build
npm run remoto &        # endpoint JSON em :5179
npm run preview         # aplicação em :4173, com /sync encaminhado
```

Abra a aplicação em **dois perfis de navegador diferentes** (ou duas janelas anônimas
separadas) — cada perfil é um dispositivo, com IndexedDB próprio.

1. Nos dois, corte a rede (DevTools → Network → *Offline*).
2. No dispositivo **A**, revise os três primeiros cartões com nota **5**.
3. No dispositivo **B**, revise os **mesmos** três cartões com nota **0**.
4. Religue a rede em **A**: ele sincroniza sozinho e a faixa mostra *3 enviada(s)*.
5. Religue a rede em **B**: *3 recebida(s), 3 enviada(s)*.
6. Clique **sincronizar** em **A**: *3 recebida(s)*.

Resultado: os dois dispositivos mostram o mesmo estado, o remoto guarda as **seis** revisões,
e para cada um dos três cartões as duas notas contam — a nota 0, por ser mais recente, é a
última aplicada, então o cartão volta a `n = 0` e `I = 1`. Nenhuma das seis revisões
desaparece. Sincronizar de novo responde *nada novo dos dois lados*.

| Critério de aceitação | Onde está |
| --- | --- |
| dois estados divergentes produzem resolução definida e documentada | `src/sync/sincronizacao.ts`, e a seção acima |
| nenhum dos dois lados perde revisões já registradas | união por `id`; o log é append-only |
| o comportamento sob conflito é reproduzível a partir de um cenário descrito | o cenário acima, e `src/sync/sincronizacao.test.ts` |

## Verificação

`npm test` cobre o domínio: SM-2 campo a campo, seleção de devidos, laço de sessão, modelo
persistido, cadeia de migrações, troca de versão de deck, rotas de cache, união de logs,
projeção e o cenário de dois dispositivos divergentes.

O comportamento de navegador é verificado num Chromium headless por scripts que ficam **fora
do repositório**, para que o instrumento não entre na medição do projeto (ver `.gitignore`):
registro do service worker e conteúdo real do cache, partida a frio offline, sobrevivência a
recarga, migração de deck ponta a ponta e o cenário de conflito com dois contextos de
navegador e o endpoint JSON de verdade.

## Fora de escopo

Por decisão do brief (§3), e portanto ausentes: áudio, ordem de traços, autoria de lições,
autenticação. O endpoint remoto não tem autenticação por essa razão.

## Uso

Espaço ou Enter revela a resposta; as teclas `0`–`5` registram a nota. Os mesmos comandos
estão disponíveis por clique. O seletor no cabeçalho troca o deck de entrada, e o botão ao
lado sincroniza com o remoto.
