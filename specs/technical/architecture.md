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
