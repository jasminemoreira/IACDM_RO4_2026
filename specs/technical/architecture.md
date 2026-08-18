# Arquitetura — hanzi-pwa-w2

Padrão: **Hexagonal (Ports & Adapters)**. A linha que corta o sistema é **puro contra
efeito**, não alto contra baixo. Confirmado pelo operador na Fase 1, iteração 1.

## V(1)

| id | module | responsibility | interface | depends-on |
|------|--------|----------------|-----------|------------|
| M-01 | scheduler | SM-2 da §4, literal e puro. Nenhum I/O, nenhum relógio implícito | `initialState() -> SchedulingState`; `applyGrade(s, q, at) -> SchedulingState`; `dueAt(s) -> number`; `isDue(s, now) -> boolean` | — |
| M-02 | review-log | Evento de revisão, ordem total, união (G-Set) e dobra em estado. Puro | `nextTimestamp(lastAt, now) -> number`; `merge(a, b) -> ReviewEvent[]`; `fold(events) -> Map<cardId, SchedulingState>`; `orderKey(e) -> [number, string]` | scheduler |
| M-03 | session | Apura devidos, percorre a fila, emite um evento por nota. Puro | `open(deck, states, now) -> Session`; `current(s) -> Card \| null`; `grade(s, q, at, replicaId) -> {session, event}`; `isComplete(s) -> boolean` | scheduler, deck |
| M-04 | deck | Valida o formato §5, deriva a versão por hash do conteúdo, difere versões, informa ids ativos. Puro | `parse(json) -> Deck`; `versionOf(deck) -> string`; `diff(prev, next) -> {added, removed, edited}`; `activeCardIds(deck) -> Set<string>` | — |
| M-05 | storage | Porta Repository e adaptador IndexedDB: log append-only, identidade da réplica, versão do deck corrente | `append(e) -> Promise<void>`; `all() -> Promise<ReviewEvent[]>`; `lastTimestamp() -> Promise<number>`; `replicaId() -> Promise<string>`; `deckVersion() -> Promise<string \| null>`; `setDeckVersion(v) -> Promise<void>` | — |
| M-06 | sync | Protocolo com o endpoint JSON: envia, busca, funde localmente, tolera rede ausente | `push(events) -> Promise<void>`; `pull(since) -> Promise<ReviewEvent[]>`; `synchronize(repo, client) -> Promise<{pushed, pulled, merged}>` | review-log, storage |
| M-07 | ui | Tela de revisão em DOM puro: hanzi, revelar, seis notas, contador, sincronizar | `mount(root, ports) -> void`; `render(viewModel) -> void` | app |
| M-08 | app | Raiz de composição: liga adaptadores ao núcleo e conduz o ciclo de vida | `start(ports) -> Promise<void>` | scheduler, review-log, session, deck, storage, sync, ui |
| M-09 | service-worker | Precache do casco no `install` e resposta a `fetch` conforme a estratégia declarada abaixo | eventos `install`, `activate`, `fetch` | — |
| M-10 | server | Node `http`: serve o app em localhost e expõe o endpoint JSON com persistência em arquivo | `GET /events?since=` ; `POST /events` ; estáticos | — |

**Módulos são diretórios de primeiro nível sob `src/`** (§2), cada um com ponto de entrada
explícito — a Facade do módulo. Nenhum módulo importa arquivo interno de outro: só a fachada.

**Núcleo puro:** M-01, M-02, M-03, M-04 — rodam sem navegador, em `node --test`.
**Efeito:** M-05, M-06, M-09, M-10. **Composição:** M-08.

## Contratos que carregam o risco

### Ordem total entre réplicas (M-02)

```
orderKey(e) = (e.at, e.replicaId)          // desempate por identificador: Lamport 1978
e.at        = max(agora, últimoAt + 1)     // monotônico POR RÉPLICA
eventId     = `${replicaId}:${at}`         // único por réplica; a união deduplica por ele
```

Duas réplicas offline produzem eventos **concorrentes por definição** — não há relação
*happened-before* entre elas. Qualquer serialização determinística é legítima, e
`(at, replicaId)` é total e idêntica nos dois lados dado o mesmo conjunto de eventos.
A divergência de relógio **não quebra a convergência**; o que ela poderia quebrar é a ordem
interna de uma réplica, e é isso que a monotonicidade de `at` impede.
Referência: [../references/lamport-total-order.md](../references/lamport-total-order.md).

### Repository como porta (M-05)

O núcleo nunca vê IndexedDB. O mesmo `review-log` executa no navegador, no `node --test` e
dentro do `server`, com adaptadores diferentes por trás do mesmo contrato.

### Estado derivado não atravessa fronteira

`(n, EF, I)` nunca é persistido como verdade nem transmitido pela rede. **Só o log viaja.**
É isso que torna "nenhuma revisão perdida" uma propriedade estrutural e não uma promessa.
Consequência colhida de graça: a migração de versão do deck (I2, critério 4) não move
progresso nenhum — apenas muda quais `id` estão ativos.

## Premissas

| # | Premissa |
|---|---|
| A-1 | A primeira carga acontece **online** — o service worker só instala na primeira visita |
| A-2 | `id` de cartão é único no deck e estável entre versões |
| A-3 | Relógios divergem entre dispositivos; a convergência depende de **determinismo**, não de concordância de relógio |
| A-4 | `at` é monotônico por réplica (`max(agora, últimoAt+1)`), logo eventos de uma réplica nunca invertem entre si |
| A-5 | `replicaId` é único entre dispositivos, gerado uma vez e persistido |
| A-6 | Deck de centenas a poucos milhares de cartões: o replay integral cabe em memória e em tempo interativo |
| A-7 | Armazenamento local **não é durável**: o navegador despeja a origem inteira, tudo de uma vez |
| A-8 | Uma aba escreve por vez. **Duas abas abertas são escritoras concorrentes** — premissa frágil, declarada de propósito |
| A-9 | O estado SM-2 nunca é fonte de verdade persistida nem transmitida; só o log é |
| A-10 | `q` é inteiro de 0 a 5; valor fora da faixa é rejeitado na fronteira |
| A-11 | Sem autenticação (§3): o servidor mantém **um único** espaço de progresso |
| A-12 | Nenhum evento é apagado ou editado — o log é estritamente append-only |

## Escopo negativo

O sistema deliberadamente **não**: cria ou edita conteúdo (§2) · toca áudio, desenha ordem de
traços, autentica (§3) · substitui o SM-2 ou acrescenta fila de repetição intra-sessão
(§4 + decisão da Fase 0) · limita cartões novos por dia · separa usuários · resolve conflito
por sobrescrita de um lado · compacta o log nesta versão (A-6 sustenta; se A-6 cair, é
mudança de arquitetura, não de escopo) · sincroniza em segundo plano ou usa Background Sync.

## Estratégia de cache (exigência escrita do I2)

| Recurso | Estratégia | Razão |
|---|---|---|
| Casco: `index.html`, JS dos módulos, CSS, ícone, manifest | **Cache first**, precacheado no `install` com `waitUntil` | Tudo-ou-nada: ou o casco inteiro entra em cache, ou o service worker não instala. É o que torna a partida a frio offline uma garantia |
| Deck JSON | **Cache first**, precacheado junto do casco | Entrada imutável (§2); revalidar não faz sentido |
| `GET/POST /events` | **Network only**, sem cache, falha tolerada | Servir sync do cache produziria fusão sobre dados velhos. Offline, a falha é esperada e o log local segue registrando |
| Navegação em `/` | **Cache first**, respondendo o casco | Garante que abrir o app offline renderize |

Estratégias nomeadas conforme [../references/service-worker-caching.md](../references/service-worker-caching.md).

## Pilha e padrões

TypeScript · `tsc` → ESM nativo, sem bundler · DOM puro, sem framework · IndexedDB direto ·
Node `http` sem dependências · `node:test` · Hexagonal · Adapter · Facade por módulo ·
Domain Model funcional · Repository como porta · thread única com service worker à parte.

---

## V(2)

Resposta unificada aos 59 achados da Iteração 1. Quatro mudanças estruturais, e o resto é
endurecimento de contrato. O princípio que guiou a integração: **onde dois achados de lentes
diferentes apontavam o mesmo mecanismo, a correção é uma só** — e onde um módulo foi atacado
por muitas lentes porque acumulava responsabilidades, a resposta é separar, não remendar.

| id | module | responsibility | interface | depends-on |
|------|--------|----------------|-----------|------------|
| M-01 | scheduler | SM-2 da §4, literal e puro. `Math.round` (meio para +∞) fixado e documentado; `EF` nunca arredondado | `initialState() -> SchedulingState`; `applyGrade(s, q, at) -> SchedulingState`; `dueAt(s) -> number`; `isDue(s, now) -> boolean` | — |
| M-02 | review-log | Ordem total, união por `eventId` e dobra em estado. **Já não gera identidade nem carimbo** — quem os aloca é `storage`. Puro | `merge(a, b) -> ReviewEvent[]`; `fold(events) -> Map<CardId, SchedulingState>`; `applyOne(state, e) -> SchedulingState`; `orderKey(e) -> [number, string, number]` | scheduler |
| M-03 | session | Apura devidos, ordena a fila por `(dueAt, id)`, percorre, emite um evento por nota. Puro | `open(deck, states, now) -> Session`; `current(s) -> Card \| null`; `reveal(s) -> Session`; `grade(s, q, at) -> {session, draft}`; `isComplete(s) -> boolean` | scheduler, deck |
| M-04 | deck | Valida o formato §5, deriva a versão por **FNV-1a sobre a forma canônica** `id\|hanzi\|pinyin\|gloss` (síncrona, insensível a espaçamento), difere versões, informa ids ativos. Puro | `parse(json) -> Deck`; `versionOf(deck) -> string`; `diff(prev, next) -> {added, removed, edited}`; `activeCardIds(deck) -> Set<CardId>` | — |
| M-05 | storage | Repository + IndexedDB. **Aloca `seq` atomicamente na mesma transação do append** e carimba `at`; esquema versionado; queda para adaptador em memória com aviso | `append(draft) -> Promise<ReviewEvent>`; `all() -> Promise<ReviewEvent[]>`; `replicaId() -> Promise<string>`; `deckVersion() -> Promise<string \| null>`; `setDeckVersion(v) -> Promise<void>`; `watermarks() -> Promise<{pushed, pulled}>`; `setWatermarks(w) -> Promise<void>`; `mode() -> 'idb' \| 'memoria'` | — |
| M-06 | sync | Protocolo sobre o **cursor `sseq` do servidor**, estado `idle\|running`, sem repetição automática, validação de tudo que entra | `push() -> Promise<{stored: string[]}>`; `pull() -> Promise<{events, sseq}>`; `synchronize() -> Promise<SyncReport>`; `state() -> 'idle' \| 'running'` | review-log, storage |
| M-07 | ui | Casco (HTML, CSS, `manifest.webmanifest`, ícone) e tela de revisão. **Não depende de nada**: recebe view model, devolve intenções por callback. Só `textContent`, nunca `innerHTML` | `mount(root, handlers) -> void`; `render(viewModel) -> void` | — |
| M-08 | app | Raiz de composição **e** laço do caso de uso: nota → `session.grade` → `storage.append` **aguardado** → recomputa → renderiza. Compara versão do deck só no arranque. Expõe diagnóstico | `start(ports) -> Promise<void>`; `diag() -> Diagnostico` | scheduler, review-log, session, deck, storage, sync, ui |
| M-09 | service-worker | Precache do casco a partir do `precache-manifest.json` gerado no build; cache nomeado pelo hash do manifesto; `activate` apaga caches de outras versões | eventos `install`, `activate`, `fetch`; `buildPrecacheManifest()` (build) | — |
| M-10 | server | Só HTTP: rotas, limite de corpo, verificação de `Origin`, bind em `127.0.0.1`, estáticos servidos por allowlist do manifesto | `GET /events?after=<sseq>`; `POST /events`; estáticos | event-store |
| M-11 | event-store | Persistência do log no servidor: append em **JSONL** (`appendFile`, O(1)), atribuição de `sseq`, leitura por cursor, deduplicação por `eventId` | `append(events) -> {stored: string[]}`; `after(sseq) -> {events, sseq}` | review-log |

### As quatro mudanças estruturais

**1. A identidade do evento deixa de depender do relógio** (resolve ASS-02 e CTL-03 de uma vez).
`eventId` passa a ser `${replicaId}#${seq}`, com `seq` alocado pelo **próprio IndexedDB**, na
mesma transação do append. Some a leitura-modificação-escrita que dois `append` concorrentes
corrompiam. E `at` volta a ser relógio de parede simples, `max(Date.now(), últimoAt local)` —
**nunca influenciado por evento remoto** —, o que elimina o integrador sem anti-windup: um
carimbo futuro vindo de fora reordena, mas não contamina os carimbos seguintes. As funções
`nextTimestamp` e `lastTimestamp()` **deixam de existir**: o desenho ficou menor.

**2. O cursor de sincronização deixa de ser `at`** (resolve ASS-03, RES-02, LIN-01, LIN-04, PERF-03).
O servidor atribui `sseq` monotônico a cada evento aceito, e o cliente pede `GET /events?after=<sseq>`,
exclusivo. Como `sseq` é do servidor, nenhum evento é pulado por relógio atrasado. `POST /events`
devolve `{stored: eventId[]}` — a lista, não a contagem — e o cliente só avança a marca d'água
dos ids que voltaram. **`sseq` é cursor de transporte e não participa da ordem de replay**: o
servidor continua sem opinião sobre agendamento.

**3. `server` se parte em dois** (resolve a concentração de 8 lentes sobre um módulo com quatro
responsabilidades). `server` fica só com HTTP; `event-store` fica com a persistência. E a
persistência muda de arquivo JSON reescrito para **JSONL com `appendFile`**: uma escrita por
evento, O(1) em vez de O(N), e uma queda no meio deixa no máximo uma linha truncada — detectável
e descartável — em vez de destruir o arquivo inteiro. Uma troca de formato resolve RES-03 e
SUS-02 e diminui o código.

**4. O ciclo `ui ↔ app` é cortado** (resolve ARQ-01). `ui` passa a não depender de nada: recebe
view model, devolve intenções por callback. `app` depende de `ui`. A raiz de composição volta a
ser raiz, e `ui` fica testável isolada.

### Premissas

| # | Premissa | Mudou em V(2)? |
|---|---|---|
| A-1 | A primeira carga acontece online — o service worker só instala na primeira visita | agora com caminho de exceção declarado em `app` |
| A-2 | `id` de cartão é único no deck e estável entre versões | — |
| A-3 | Relógios divergem; a convergência depende de determinismo, não de concordância de relógio | — |
| A-4 | **A identidade do evento não depende do relógio:** `${replicaId}#${seq}`, com `seq` alocado atomicamente pelo armazenamento | **reescrita** |
| A-5 | `replicaId` é único entre dispositivos, gerado uma vez e persistido | — |
| A-6 | **O custo do replay é governado pelo número de EVENTOS, não pelo tamanho do deck.** Teto de projeto: 10⁵ eventos, a medir na Fase 6 | **reescrita** |
| A-7 | Armazenamento local não é durável; `navigator.storage.persist()` é pedido e o estado é mostrado ao usuário | endurecida |
| A-8 | Uma aba escreve por vez. **Duas abas continuam sendo escritoras concorrentes** — o `seq` atômico impede colisão de identidade, mas não impede duas visões divergentes em memória. Premissa frágil, mantida de propósito | parcialmente mitigada |
| A-9 | O estado SM-2 nunca é fonte de verdade persistida nem transmitida; só o log é | — |
| A-10 | `q` é inteiro de 0 a 5; validado na fronteira de entrada **e na ingestão do remoto** | endurecida |
| A-11 | Um único espaço de progresso por instância de servidor (§3 exclui autenticação) | — |
| A-12 | Nenhum evento é apagado ou editado — o log é estritamente append-only | — |
| A-13 | **Um dia são 86 400 000 ms exatos: sem horário de verão, sem segundo bissexto** | **nova** |
| A-14 | **A fila da sessão é apurada na abertura e não reavaliada — é isso que garante a terminação** | **nova** |
| A-15 | **`sseq` é cursor de transporte e não participa da ordem de replay** | **nova** |
| A-16 | **`EF` nunca é arredondado na serialização: a convergência exige identidade bit-a-bit IEEE 754** | **nova** |

### Escopo negativo — inalterado

Idêntico ao de V(1). Nenhum requisito foi cortado e nenhuma funcionalidade foi acrescentada:
todas as mudanças respondem "como isto falha?", nenhuma responde "o que mais poderia fazer?".

### Estratégia de cache — atualizada

| Recurso | Estratégia | Razão |
|---|---|---|
| Casco (`index.html`, JS, CSS, ícone, `manifest.webmanifest`) | **Cache first**, precacheado no `install` a partir de `precache-manifest.json` gerado no build | Tudo-ou-nada; e a lista gerada não desatualiza quando um módulo novo entra |
| Deck JSON | **Cache first**, precacheado junto | Entrada imutável (§2) |
| `GET/POST /events` | **Network only**, sem cache, falha tolerada | Fundir sobre dados velhos seria pior que não fundir |
| Navegação em `/` | **Cache first**, respondendo o casco | Abrir offline tem de renderizar |
| **Ciclo de vida do cache** | Nome do cache = hash do manifesto; `activate` apaga os demais; `skipWaiting` + `clients.claim` | Sem isso, quem instalou a v1 nunca recebe correção nenhuma |
