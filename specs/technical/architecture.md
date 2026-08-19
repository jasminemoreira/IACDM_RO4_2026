# Arquitetura — PWA de estudo de chinês

Padrão: **Hexagonal (Ports & Adapters)**. Núcleo puro, sem I/O, atrás de portas;
tecnologia externa entra como adaptador.
Stack: TypeScript + Vite · IndexedDB via `idb` · vite-plugin-pwa (Workbox) · sem framework de UI.
§2 de REQUISITOS.md: **módulo = diretório de 1º nível sob `src/`**, com ponto de
entrada explícito (`src/<modulo>/index.ts`).

## V(1) — Decomposição

| id | module | responsibility | interface | depends-on |
|------|--------|----------------|-----------|------------|
| M-01 | scheduler | SM-2 da §4, puro e sem I/O. Única encarnação do algoritmo congelado | `applyReview(s: SchedState, q: Grade) -> SchedState` · `nextDueDay(localDay, i) -> DayStr` · `isDue(dueDay \| null, today) -> boolean` · `INITIAL = {n:0, ef:2.5, i:0}` | — |
| M-02 | deck | Carregar e validar o deck JSON (§5); expor a versão do conteúdo | `loadDeck(fetch) -> Promise<Deck>` · `validateDeck(unknown) -> Deck` (lança em malformado) | — |
| M-03 | progress | Projetar o log de revisões em estado de cartão. Define a ORDEM CANÔNICA | `canonicalOrder(a,b) -> number` · `projectCard(reviews) -> CardState` · `projectAll(reviews) -> Map<CardId,CardState>` | scheduler |
| M-04 | storage | Portas de persistência + adaptador IndexedDB (`idb`). Nada de regra de domínio | `ReviewRepository{append(r), all(), byCard(id)}` · `DeckRepository{save(d), load()}` · `MetaRepository{getDeckVersion(), setDeckVersion(v)}` | deck, progress (só tipos) |
| M-05 | migration | Detectar troca de versão do deck e relatar adicionados/removidos/editados; upgrade de esquema do IndexedDB | `diffDecks(prev, next) -> DeckDiff` · `applyDeckVersion(next, repos) -> Promise<MigrationReport>` | deck, storage |
| M-06 | sync | Porta de transporte + duplo local + reconciliação por união de log e replay | `Transport{pull(), push(reviews)}` (porta) · `LocalDoubleTransport` (adaptador) · `reconcile(local, remote) -> Review[]` (união por `eventId`) · `sync(repos, transport) -> Promise<SyncReport>` | progress, storage |
| M-07 | session | Serviço de aplicação: monta a fila de devidos e registra notas | `buildQueue(deck, states, today) -> Card[]` · `grade(cardId, q, now, deviceId) -> Promise<void>` · `currentState() -> SessionView` | deck, progress, scheduler, storage |
| M-08 | ui | Web UI em TS puro: tela de revisão, fim de sessão, estado sem cartões devidos. 4 botões de nota (q = 0/3/4/5) | `mount(root: HTMLElement, session: SessionApi) -> void` | session |
| M-09 | service-worker | Precache do app shell e do deck; estratégias de cache declaradas; manifest. **Não** acessa o log | config `vite-plugin-pwa` + `sw.ts` · registra em `main.ts` | — |

Ponto de entrada da aplicação: `src/main.ts` compõe os adaptadores concretos e
injeta nas portas (única camada que conhece todo mundo).

## Tipos do domínio

```ts
type CardId = string
type DayStr = string          // 'YYYY-MM-DD', dia LOCAL — nunca recalculado
type Grade = 0|1|2|3|4|5      // §4 define 0..5; a UI emite 0,3,4,5 (D5)

type Card      = { id: CardId; hanzi: string; pinyin: string; gloss: string }
type Deck      = { version: number; cards: Card[] }
type Review    = { eventId: string; cardId: CardId; q: Grade
                 ; at: number; localDay: DayStr; deviceId: string }
type SchedState= { n: number; ef: number; i: number }
type CardState = SchedState & { cardId: CardId; dueDay: DayStr | null }  // null = nunca revisado = devido agora
```

## Contratos que atravessam módulos (Design by Contract)

- **C-1** `scheduler.applyReview` é **total e pura**: mesma entrada, mesma saída,
  sem relógio, sem I/O, sem aleatoriedade. Todo caminho que reagenda passa por ela.
- **C-2** `Review` é **imutável e append-only**. Nenhum módulo edita ou remove
  revisão. `eventId` é único e é a chave da união em `reconcile`.
- **C-3** `CardState` **nunca é persistido como verdade**. É sempre derivado por
  `progress.projectCard`. Cache em memória é permitido; cache em disco não.
- **C-4** Ordem canônica do replay: `at` crescente, desempate por `deviceId`,
  depois por `eventId`. Determinística e independente de quem reconcilia.
- **C-5** `reconcile(a, b)` é **comutativa, associativa e idempotente** (união de
  conjunto por `eventId`) — é o que dá convergência sem coordenação.
- **C-6** O núcleo (M-01, M-02, M-03, M-06/reconcile) não importa nada de
  `window`, `indexedDB` ou `fetch`. Roda em Node, testável sem navegador.
- **C-7** `service-worker` cacheia ativos e o `deck.json`; **não** lê nem escreve
  progresso. Sem essa fronteira, haveria dois escritores do log.

## Premissas (A-N) — numeradas para a Fase 6 protegê-las com teste

- **A-1** O relógio do dispositivo é razoável para ordenar revisões do MESMO
  dispositivo. Entre dispositivos NÃO se assume relógio sincronizado — por isso o
  desempate de C-4 inclui `deviceId` e `eventId`.
- **A-2** `Card.id` é estável entre versões do deck: a identidade do progresso é o
  `id`, não o conteúdo (decisão de P0 sobre migração).
- **A-3** O log de revisões é append-only e nunca sofre edição ou remoção local.
- **A-4** `{n, EF, I}` é **função pura** do log daquele cartão pela §4. Nenhum
  outro caminho produz estado derivado.
- **A-5** A aplicação roda em contexto seguro (HTTPS ou `localhost`). `file://`
  não registra service worker — verificado em MDN, não presumido.
- **A-6** IndexedDB está disponível; a aplicação NÃO assume durabilidade
  indefinida (o navegador pode evictar sob pressão de armazenamento).
- **A-7** O volume de revisões por cartão é pequeno (dezenas), tornando o replay
  O(revisões) aceitável sem snapshot. Premissa a MEDIR, não a supor.
- **A-8** Execução single-threaded no contexto da janela; o service worker roda em
  outra thread mas nunca escreve no log (C-7).
- **A-9** O deck cabe em memória (~50 cartões; milhares no pior caso).
- **A-10** O `localDay` gravado no evento é a autoridade e nunca é recalculado a
  partir do fuso de quem lê.
- **A-11** Uma revisão registrada é imediatamente durável antes de a UI avançar
  para o próximo cartão (senão o clique duplo do EDGE-7 ou uma recarga perdem a nota).

## Escopo negativo — o que o sistema deliberadamente NÃO faz

| Não faz | Razão |
|---|---|
| Áudio, ordem de traços, autoria/edição, autenticação | §3 de REQUISITOS.md |
| Servidor remoto real | Decisão P0: duplo local (permitido por §6 Inc.3) |
| Importação de deck pelo usuário | Decisão P0: deck é arquivo estático |
| Relearning intra-sessão | D2 — a §4 não contém a regra |
| Migração de **esquema** do deck | §5 congela o formato do cartão |
| Substituir ou "simplificar" o SM-2 | §4 proíbe explicitamente |
| Persistir estado do cartão como verdade | C-3 — violaria a invariante central |
| Snapshot do replay | Otimização antes de medir; cria segunda fonte de verdade |
| Web Worker para replay | Idem — A-7 precisa ser medida antes |

---

# V(2) — após a crítica adversarial da Iteração 1

Mudança estrutural: **9 → 8 módulos**. `migration` foi ELIMINADO (não por gosto: a
descoberta da Fase 1 — troca de deck não migra dado algum — deixou-o com uma única
função, `diffDecks`, que pertence a quem conhece o formato do deck). `sync` perdeu
seu núcleo para `progress`, ficando só com transporte e procedimento. **Nenhum
módulo foi ADICIONADO.** Cada correção remove ou realoca; nenhuma acrescenta
componente (AP2).

## V(2) — Decomposição (tabela COMPLETA)

| id | module | responsibility | interface | depends-on |
|------|--------|----------------|-----------|------------|
| M-01 | scheduler | SM-2 da §4, puro e sem I/O. Única encarnação do algoritmo congelado | `applyReview(s: SchedState, q: Grade) -> SchedState` · `nextDueDay(day: LocalDay, i: Days) -> LocalDay` · `isDue(due: LocalDay \| null, today: LocalDay) -> boolean` · `INITIAL: SchedState` | — |
| M-02 | deck | Carregar, VALIDAR e versionar o deck (§5); comparar duas versões | `parseDeck(u: unknown) -> Result<Deck, DeckError>` · `loadDeck(fetch) -> Promise<Result<Deck, DeckError>>` · `diffDecks(prev, next) -> DeckDiff` | — |
| M-03 | progress | **Álgebra do log**: validar evento, ordenar, unir e projetar. Todo o núcleo do Incremento 3 vive aqui | `parseReview(u: unknown) -> Result<Review, ReviewError>` · `canonicalOrder(a, b) -> number` · `union(a: Review[], b: Review[]) -> Review[]` · `projectCard(rs: Review[]) -> CardState` · `projectAll(rs: Review[]) -> Map<CardId, CardState>` | scheduler |
| M-04 | storage | Portas de persistência + adaptador IndexedDB, INCLUSIVE a versão de esquema e o `deviceId` | `ReviewRepository{append, all, byCard}` · `DeckRepository{save, load}` · `MetaRepository{deckVersion, deviceId}` · `openDb() -> Promise<Result<Db, StorageError>>` · `estimateQuota() -> Promise<QuotaInfo>` | deck, progress (só `import type`) |
| M-05 | sync | **Só transporte e procedimento.** Porta plugável + duplo local + o passo a passo da sincronização | `Transport{pull() -> Promise<Review[]>; push(rs: Review[]) -> Promise<void>}` (porta) · `LocalDoubleTransport` (adaptador) · `sync(repos, transport) -> Promise<SyncReport>` | progress, storage |
| M-06 | session | Serviço de aplicação: fila de devidos, máquina de estados da sessão, registro de nota | `buildQueue(deck, states, today) -> Card[]` · `grade(cardId, q) -> Promise<Result<void, WriteError>>` · `view() -> SessionView` · `SessionState = 'queue-empty' \| 'showing' \| 'revealed' \| 'writing' \| 'done' \| 'error'` | deck, progress, scheduler, storage |
| M-07 | ui | Web UI em TS puro; 4 botões (q = 0/3/4/5); telas de revisão, fim, vazio e ERRO | `mount(root: HTMLElement, api: SessionApi) -> void` · renderiza SEMPRE por `textContent` · botões desabilitados no estado `writing` | session |
| M-08 | service-worker | Precache do app shell e do deck; estratégias por tipo de ativo; manifest; sinal de prontidão offline | config `vite-plugin-pwa` + `sw.ts` · emite `offline-ready` e `sw-version` para a app | — |

## Tipos — semântica no TIPO, não em comentário (LING-01, LING-04)

```ts
type CardId    = string & { readonly __brand: 'CardId' }
type EventId   = string & { readonly __brand: 'EventId' }   // crypto.randomUUID()
type DeviceId  = string & { readonly __brand: 'DeviceId' }  // crypto.randomUUID(), 1x por instalação
type LocalDay  = string & { readonly __brand: 'LocalDay' }  // 'YYYY-MM-DD'
type Days      = number & { readonly __brand: 'Days' }      // unidade explícita
type EpochMs   = number & { readonly __brand: 'EpochMs' }   // milissegundos, nunca segundos

type Review = { eventId: EventId; cardId: CardId; q: Grade
              ; atEpochMs: EpochMs; localDay: LocalDay; deviceId: DeviceId }
type SchedState = { n: number; ef: number; i: Days }
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
```

## Contratos novos e revisados

- **C-1..C-7** permanecem como em V(1).
- **C-8 (novo — resolve ASS-01).** O estado derivado é **provisório antes da
  sincronização e convergente depois dela**. A convergência de C-5 é propriedade do
  estado pós-união, nunca do estado de um dispositivo que ainda não sincronizou. A
  evicção do navegador é **por origem e total, não parcial** (MDN), logo o modo de
  falha real é perda total — reparada pela união com o remoto, sem maquinário novo.
- **C-9 (novo — resolve SEC-02, LING-02, LING-03).** Tudo que cruza fronteira
  externa passa por UM parser que devolve `Result`: `parseReview` no transporte,
  `parseDeck` no arquivo. Faixa validada (`q ∈ 0..5`, `atEpochMs` finito e positivo,
  `localDay` no formato, ids não vazios, sem `cardId` fora do deck). Evento inválido
  é **rejeitado e relatado**, nunca anexado — o log é append-only, então um evento
  envenenado seria permanente. `eventId` é `crypto.randomUUID()`: colisão deixa de
  ser cenário.
- **C-10 (novo — resolve PROC-01, e é o motivo de REJEITAR o sync incremental).**
  A sincronização é: `pull` → `union(local, remoto)` → anexar ao local o que falta →
  `push(log local completo)`. Como a união é idempotente e nada é jamais removido,
  uma revisão anexada **durante** a sincronização é incluída ou entra na próxima —
  em nenhum caso é perdida ou duplicada. Não é preciso trava nem transação
  distribuída: a propriedade vem do append-only. **A troca do log ÍNTEGRO é o
  mecanismo de reparo de C-8**; trocá-la por sync incremental quebraria o reparo.
- **C-11 (novo — resolve MIG-01, RES-01).** O `deck.json` entra no manifesto de
  precache com revisão de conteúdo, e uma nova versão de deck implica **novo build**.
  O precache do Workbox é tudo-ou-nada: se algum ativo falha, o SW não ativa — logo
  não existe estado "instalado com cache parcial" persistente.
- **C-12 (novo — resolve GOV-01).** `deviceId` é gerado uma vez com
  `crypto.randomUUID()` e guardado em `MetaRepository`. Ele é **copiado para dentro
  de cada evento** e ali é imutável: regenerá-lo após evicção afeta apenas eventos
  futuros e **não altera a ordem canônica de eventos já existentes**.
- **C-13 (novo — resolve REG-02).** A declaração escrita da estratégia de cache tem
  dono e endereço: `specs/technical/cache-strategy.md`, mantido em sincronia com a
  config do `service-worker`.

## Premissas — V(2)

A-1..A-11 de V(1) permanecem, com estas revisões e acréscimos:

- **A-6 (revisada).** A evicção do IndexedDB é por origem e total, não parcial
  (MDN, *Storage quotas and eviction criteria*). Consequência derivada, que faltava
  em V(1): perda total é reparável por sincronização; perda parcial não é modo de
  falha do navegador.
- **A-7 (inalterada, agora com gatilho).** Volume pequeno de revisões. Se o log de
  um cartão passar de 500 eventos, ou o total passar de 50 000, a decisão de não
  fazer snapshot **deve ser reexaminada** (limiar declarado — resolve SUS-01).
- **A-12 (nova).** `crypto.randomUUID()` existe em contexto seguro — o mesmo que o
  service worker já exige (A-5). Nenhuma dependência nova.
- **A-13 (nova).** Duas abas da mesma origem compartilham o IndexedDB; a projeção em
  memória de uma aba pode estar velha até a próxima montagem de fila. **Declarado,
  não corrigido**: corrigir exigiria BroadcastChannel — componente novo (AP2).
- **A-14 (nova).** Versões de dependência são fixadas com `~` no `package.json` e o
  alvo de navegador declarado é Chrome/Edge/Firefox correntes; Safari/iOS é
  suportado com a ressalva de evicção após 7 dias sem uso (resolve MEC-01, MEC-02).

## Escopo negativo — V(2) (acréscimos aos 9 de V(1))

| Não faz | Razão |
|---|---|
| Sync incremental / marca-d'água | Quebraria o reparo de C-8 — a troca integral é funcionalidade, não desperdício |
| Trava ou transação distribuída na sincronização | Desnecessária: a propriedade vem do append-only (C-10) |
| Teto diário de cartões na fila (avalanche) | Seria FEATURE nova — decisão de escopo do operador, não da Fase 3 (AP9) |
| Invalidação entre abas (BroadcastChannel) | Componente novo para cenário declarado em A-13 |
| Detecção de reuso de `id` entre versões do deck | Exigiria heurística de conteúdo; A-2 é premissa contratual do autor do deck |

## Tipos que faltavam em V(1) (IMP-02, IMP-03, IMP-04)

```ts
type DeckDiff   = { added: CardId[]; removed: CardId[]; edited: CardId[] }
type SyncReport = { pulled: number; rejected: number; merged: number
                  ; localBefore: number; localAfter: number; pushed: number }
type QuotaInfo  = { usageBytes: number; quotaBytes: number; persisted: boolean }
type SessionView =
  | { state: 'queue-empty'; nextDueDay: LocalDay | null }      // UX-02
  | { state: 'showing';  card: Card; index: number; total: number }   // UX-05
  | { state: 'revealed'; card: Card; index: number; total: number }
  | { state: 'writing';  card: Card; index: number; total: number }   // UX-01/UX-04: botões inertes
  | { state: 'done';     reviewed: number }
  | { state: 'error';    kind: 'deck' | 'storage' | 'sync'; message: string } // PROC-04
type SessionApi = { view(): SessionView; reveal(): void
                  ; grade(q: Grade): Promise<void>; syncNow(): Promise<SyncReport> } // UX-06
```

Object stores do IndexedDB (IMP-05): `reviews` com `keyPath: 'eventId'` e índice
em `cardId`; `deck` chaveado por versão; `meta` (deckVersion, deviceId).

## Premissas — adendo V(2)

- **A-15 (nova).** "Hoje" é lido do relógio local no momento da consulta. Mudar o
  fuso do dispositivo ou corrigir o relógio muda o que está devido, **sem que
  nenhuma revisão tenha ocorrido**. Declarado e aceito: proteger contra isso exigiria
  um relógio confiável que a plataforma não oferece (ASS-02).
- **A-16 (nova).** O replay executa a MESMA sequência de operações de ponto
  flutuante, na mesma ordem canônica, nos dois dispositivos. IEEE-754 em JS é
  determinístico, logo o EF resultante é bit-idêntico — a divergência de MEC-03 não
  se materializa. Comparações em teste usam ε = 1e-9 mesmo assim.
- **A-17 (nova).** `parseDeck` rejeita deck com mais de 5 000 cartões, ids
  duplicados ou campos vazios — o limite de A-9 deixa de ser suposição e vira
  validação (ASS-03).

## Contratos — adendo V(2)

- **C-14 (novo — resolve PERF-01, ARQ-02).** `session` **não** guarda projeção em
  cache: `projectAll` é recomputada uma vez por montagem de fila e uma vez por nota
  registrada. Nenhum estado derivado sobrevive fora do escopo dessas chamadas —
  C-3 vale também para a memória.
- **C-15 (novo — resolve PROC-03).** O diff de versão do deck roda na inicialização
  da aplicação, dentro de `session`, quando a versão do deck carregado difere da
  registrada em `MetaRepository`. Dono único, momento único.

---

# V(3) — após a crítica adversarial da Iteração 2

(Contador do motor Versus: V(4). Esta é a terceira versão do desenho.)

**Nenhum módulo adicionado, removido ou reestruturado.** Os 8 módulos de V(2)
permanecem com as mesmas responsabilidades, com uma exceção: `storage` deixa de
CRIAR o `deviceId`. As mudanças são de contrato — e três delas **removem** regra.

## V(3) — Decomposição (tabela COMPLETA)

| id | module | responsibility | interface | depends-on |
|------|--------|----------------|-----------|------------|
| M-01 | scheduler | SM-2 da §4, puro e sem I/O. Única encarnação do algoritmo congelado | `applyReview(s: SchedState, q: Grade) -> SchedState` · `nextDueDay(day: LocalDay, i: Days) -> LocalDay` (**aritmética de calendário**, SCI-03) · `isDue(due, today) -> boolean` · `INITIAL: SchedState` | — |
| M-02 | deck | Carregar, validar e versionar o deck (§5); comparar duas versões | `parseDeck(u) -> Result<Deck, DeckError>` · `loadDeck(fetch) -> Promise<Result<Deck, DeckError>>` · `diffDecks(prev, next) -> DeckDiff` | — |
| M-03 | progress | Álgebra do log: validar evento, ordenar, unir, projetar | `parseReview(u) -> Result<Review, ReviewError>` · `canonicalOrder(a,b) -> number` · `union(a,b) -> Review[]` · `projectCard(rs) -> CardState` · `projectAll(rs) -> Map<CardId,CardState>` · `applyOne(s: CardState, r: Review) -> CardState` (PERF-04) | scheduler |
| M-04 | storage | Portas de persistência + adaptador IndexedDB. **Guarda** o deviceId; não o cria | `ReviewRepository{append, all, byCard}` · `DeckRepository{save, load}` · `MetaRepository{deckVersion, deviceId}` · `openDb() -> Promise<Result<Db, StorageError>>` · `estimateQuota() -> Promise<QuotaInfo>` | deck, progress (`import type`) |
| M-05 | sync | Transporte e procedimento | `Transport{pull() -> Promise<Review[]>; **merge**(rs: Review[]) -> Promise<void>}` (porta) · `LocalDoubleTransport` (adaptador) · `sync(repos, transport) -> Promise<SyncReport>` | progress, storage |
| M-06 | session | Fila de devidos, máquina de estados, registro de nota, diff de versão do deck na inicialização | `buildQueue(deck, states, today) -> Card[]` · `grade(q: Grade) -> Promise<Result<void, WriteError>>` · `view() -> SessionView` · `syncNow() -> Promise<SyncReport>` | deck, progress, scheduler, storage |
| M-07 | ui | Web UI em TS puro; 4 botões; telas de revisão, fim, vazio e erro; controle de sincronização SEMPRE alcançável | `mount(root, api: SessionApi) -> void` · só `textContent` · botões inertes em `writing` | session |
| M-08 | service-worker | Precache, estratégias, manifest, sinais de estado | config `vite-plugin-pwa` + `sw.ts` · sinais por **`postMessage` para os clientes** (IMP-06) | — |

`src/main.ts` (raiz de composição) gera o `deviceId` com `crypto.randomUUID()` na
primeira execução e o entrega a `storage` para guardar (ARQ-07). Criar identidade
não é persistir.

## Contratos revisados

- **C-9 (revisado — resolve ASS-06).** `parseReview` valida **forma e faixa apenas**:
  `q ∈ 0..5`, `atEpochMs` finito, positivo e **não mais que 24 h no futuro** em
  relação ao relógio de quem recebe (SEC-05), `localDay` no formato, ids não vazios.
  **A regra "rejeitar cardId fora do deck" foi REMOVIDA**: o log sobrevive a
  qualquer versão de deck, e um cartão removido na v2 tem revisões históricas
  legítimas que a decisão de P0 mandou preservar. Pertencer ao deck corrente não é
  critério de validade.
- **C-10 (revisado — resolve LING-05).** `Transport.push` foi **renomeado para
  `merge`**, e o contrato diz o que o nome promete: o remoto **une** os eventos
  recebidos com os que já tem e **nunca substitui**. Um `merge` obsoleto é inofensivo
  — a união é idempotente. Com isso a sincronização é simétrica: os dois lados
  aplicam a mesma operação, e a perda que a §6 Inc.3 proíbe não tem por onde entrar.
- **C-8 (revisado — resolve RES-06, GOV-05).** O reparo por sincronização só vale
  quando o par está em **domínio de falha distinto**. O duplo local **não é backup**
  e não faz promessa de durabilidade: evicção por origem destrói os dois. A alegação
  foi reduzida ao que é verdade — reparo entre DISPOSITIVOS distintos. O duplo local
  existe para exercitar a reconciliação, que é o que a §6 Inc.3 diz importar.
- **C-14 (revisado — resolve PERF-04).** `projectAll` roda uma vez por montagem de
  fila. Ao registrar uma nota, aplica-se `applyOne` **só ao cartão afetado** — o que
  é equivalente ao replay, porque o evento novo é o mais recente daquele cartão e a
  ordem canônica o coloca por último. Custo O(1) por nota em vez de O(log). Não é
  cache: é derivação incremental com equivalência demonstrável.
- **C-15 (revisado — resolve MIG-05).** `DeckRepository.save` é chamado a cada carga
  bem-sucedida, logo o deck anterior está sempre em `storage`; o diff da
  inicialização compara o guardado com o carregado.
- **C-16 (novo — resolve PROC-05).** O estado `writing` tem prazo: se a gravação não
  resolver em 5 s, a sessão transita para `error` com `kind: 'storage'`.
- **C-17 (novo — resolve GOV-04).** A sincronia entre `cache-strategy.md` e a
  configuração do service worker é verificada por **teste** na Fase 6: o manifesto
  gerado deve conter o app shell e o `deck.json`. Documento normativo com checagem
  mecânica, não com disciplina.
- **C-18 (novo — resolve LING-06).** Assinatura única de registro de nota:
  `grade(q: Grade) -> Promise<Result<void, WriteError>>`. O `cardId` vem do estado
  corrente da sessão, nunca do chamador.
- **C-19 (novo — resolve OBS-04).** `estimateQuota()` tem consumidor e limiar: é
  consultada na inicialização e, acima de 80 % de uso, a interface exibe aviso.
  Capacidade sem consumidor seria API morta.
- **C-20 (novo — resolve UX-07).** O controle de sincronização é alcançável de
  **qualquer** estado da sessão, não só de `done` e `queue-empty` — senão a avalanche
  aceita em CTRL-02 tornaria a sincronização inalcançável justo para quem mais precisa.

## Premissas — V(3)

A-1..A-15 e A-17 permanecem. Revisões e acréscimos:

- **A-16 (revisada — resolve CTRL-03).** O resultado bit-idêntico entre dispositivos
  vale **após a sincronização**, quando ambos têm o mesmo conjunto de eventos. Antes
  dela, C-8 já dizia que o estado é provisório; A-16 agora diz o mesmo.
- **A-14 (revisada — resolve MEC-05).** `vite-plugin-pwa` é fixado em versão exata e
  o lockfile é comitado, porque a dependência que realmente importa — o Workbox — é
  **transitiva** e `~` na direta não a alcança.
- **A-7 (revisada — resolve SUS-03).** O limiar de 50 000 eventos passa a governar
  também o **transporte**, não só o replay. Ordem de grandeza: 50 000 eventos ×
  ~120 B ≈ 6 MB por sincronização.
- **A-18 (nova).** Dentro de um dispositivo, o relógio não retrocede durante uma
  sessão. É o que sustenta a equivalência de `applyOne` em C-14; se retroceder, a
  próxima montagem de fila (replay completo) corrige.

## Escopo negativo — V(3) (acréscimo)

| Não faz | Razão |
|---|---|
| Backup do progresso | O duplo local não é backup (C-8 revisado); backup real seria funcionalidade nova, não pedida por REQUISITOS.md |
