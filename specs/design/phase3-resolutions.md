# Fase 3 — resolução dos 64 achados da Iteração 1 (V(1) → V(2))

Legenda: **R** resolvido · **A** aceito com justificativa · **D** diferido a v2.0

## 🔴 Críticos (7) — todos resolvidos

| id | st | como |
|---|---|---|
| ASS-01 | R | C-8: estado é provisório pré-sync e convergente pós-sync; A-6 revisada — a evicção do navegador é por origem e TOTAL (MDN), logo "log truncado no meio" não é modo de falha real, e perda total é reparada pela união com o remoto. Zero maquinário novo |
| SEC-02 | R | C-9: `parseReview` valida forma e faixa na fronteira e devolve `Result`; evento inválido é rejeitado e relatado, nunca anexado |
| RES-01 | R | C-11: o precache do Workbox é tudo-ou-nada — se um ativo falha, o SW não ativa; não existe estado persistente de cache parcial. Sinal `offline-ready` avisa o usuário |
| MIG-01 | R | C-11: `deck.json` entra no manifesto com revisão de conteúdo e nova versão de deck implica novo build |
| PROC-01 | R | C-10: procedimento definido (pull → union → anexar faltantes → push íntegro). Revisão anexada durante a sincronização entra nesta ou na próxima — nunca se perde nem duplica, porque a união é idempotente e nada é removido. Sem trava, sem transação distribuída |
| GOV-01 | R | C-12: `deviceId` é `crypto.randomUUID()` guardado em Meta e COPIADO para dentro do evento, onde é imutável. Regenerá-lo após evicção afeta só eventos futuros e não altera a ordem canônica dos existentes |
| LING-01 | R | Tipos *branded*: `EpochMs`, `LocalDay`, `Days`, `CardId`, `EventId`, `DeviceId`. A semântica sai do comentário e entra no tipo |

## 🟡 Importantes (44)

| id | st | como |
|---|---|---|
| ASS-02 | A | A-15: "hoje" vem do relógio local na consulta; mudar fuso ou relógio muda o que está devido. Proteger exigiria relógio confiável que a plataforma não oferece |
| ASS-03 | R | A-17 + `parseDeck` rejeita mais de 5 000 cartões, ids duplicados ou campos vazios. O limite deixa de ser suposição |
| ASS-04 | R | `grade` devolve `Result<void, WriteError>`; estado `error` na máquina de estados; tela de erro |
| ASS-05 | R | C-11. duplica: MIG-01 |
| ARQ-02 | R | C-14: `session` não guarda projeção em cache e não decide sobre estado derivado; recomputa por montagem de fila |
| ARQ-03 | R | `reconcile`/`union` MOVIDO para `progress` (álgebra do log junto da ordem do log). `sync` fica só com transporte e procedimento |
| ARQ-04 | R | Upgrade de esquema passa a `storage`, que abre o banco. `migration` foi eliminado |
| IMP-01 | R | Interface do `service-worker` passa a incluir os sinais `offline-ready` e `sw-version`; a estratégia por tipo de ativo e a política de atualização vivem em specs/technical/cache-strategy.md (C-13) |
| IMP-02 | R | C-10 define o procedimento; `SyncReport` definido em tipo |
| IMP-03 | R | `DeckDiff` definido; `MigrationReport` deixou de existir com o módulo |
| IMP-04 | R | `SessionApi`, `SessionView` e `SessionState` definidos, com o estado `revealed` explícito |
| SEC-01 | R | Contrato de `ui`: renderização SEMPRE por `textContent`, nunca `innerHTML` |
| PERF-01 | R | C-14 declara a política: uma projeção por montagem de fila e uma por nota registrada |
| PERF-02 | A | **Aceito deliberadamente**: a troca do log íntegro É o mecanismo de reparo de C-8. Sync incremental foi para o escopo NEGATIVO por quebrá-lo |
| PERF-03 | A | Aceito sob A-7, agora com gatilho: 500 eventos por cartão ou 50 000 no total obrigam a reexaminar a decisão de não usar snapshot |
| REG-01 | R | §7 ganhou dono e mecanismo: specs/technical/commit-protocol.md |
| REG-02 | R | C-13: specs/technical/cache-strategy.md é o artefato designado |
| RES-02 | R | `openDb` devolve `Result<Db, StorageError>`; falha vira tela de erro explícita em vez de quebra silenciosa |
| RES-03 | R | C-10: a sincronização é idempotente ponta a ponta; um `push` falho é reparado pela próxima sincronização, sem estado intermediário inválido |
| RES-04 | R | `storage` trata o evento `blocked` do idb como `StorageError` próprio, com mensagem pedindo fechar as outras abas |
| RES-05 | A | A-13: declarado, não corrigido — corrigir exigiria BroadcastChannel, componente novo (AP2) |
| UX-01 | R | Estado `writing` na máquina de estados; a UI mostra o cartão em escrita e inerte |
| UX-02 | R | `SessionView` do estado `queue-empty` carrega `nextDueDay` |
| UX-03 | R | Contrato de acessibilidade em `ui`: teclado (revelar e notar), gestão de foco, rótulos para leitor de tela e `lang="zh-Hans"` no hanzi |
| UX-04 | R | Mesmo mecanismo de UX-01: botões inertes no estado `writing` |
| UX-06 | R | Gatilho definido: `syncNow()` em `SessionApi`, acionado por botão nas telas de fim de sessão e de fila vazia. Sem sincronização automática — nada implícito |
| MIG-02 | R | Declarado: o deck carregado é a autoridade; a versão registrada em Meta é informativa e aceita retroceder |
| MIG-03 | R | Upgrade falho vira `StorageError` com tela de erro; e o log é reconstruível a partir do remoto por C-8 |
| MIG-04 | A | A-2 é premissa contratual do autor do deck; detectar reuso de id exigiria heurística de conteúdo — foi para o escopo negativo |
| SUS-01 | R | A-7 com limiar numérico declarado (500 / 50 000) |
| PROC-02 | R | `SessionState` explícito com seis estados; transições órfãs deixam de ser indefinidas |
| PROC-03 | R | C-15: o diff roda na inicialização, dentro de `session`, quando a versão difere da registrada. Dono único, momento único |
| PROC-04 | R | Estado `error` com discriminante `kind: 'deck' \| 'storage' \| 'sync'` |
| GOV-02 | R | Declarado: o caminho de apagamento é o "limpar dados do site" do navegador. Nenhum código novo — mas deixa de ser imortalidade por acidente |
| OBS-01 | R | `SyncReport` definido (pulled, rejected, merged, localBefore, localAfter, pushed) e exibido após a sincronização |
| OBS-02 | R | Sinais `offline-ready` e `sw-version` |
| OBS-03 | R | `storage.estimateQuota()` exposto |
| CTRL-01 | A | **Não corrigível sem violar §4 congelada.** O windup assimétrico do EF é consequência direta de D1, que é o texto do requisito. Documentado como comportamento esperado, não como defeito |
| CTRL-02 | A | Teto diário seria FEATURE nova — Fase 3 sugere, nunca decide escopo (AP9). Levado ao operador na decisão pós-ciclo |
| LING-02 | R | C-9: `eventId` é `crypto.randomUUID()`; colisão deixa de ser cenário |
| LING-03 | R | C-9: `parseDeck` com regras explícitas do que é malformado |
| MEC-01 | R | A-14: versões fixadas com `~` no package.json |
| MEC-02 | R | A-14: alvo declarado (Chrome/Edge/Firefox correntes; Safari/iOS com ressalva de evicção após 7 dias sem uso) |
| MEC-03 | R | A-16: o replay executa a mesma sequência de operações na mesma ordem canônica; IEEE-754 em JS é determinístico, logo o EF é bit-idêntico. Testes usam ε = 1e-9 |

## 🟢 Sugestões (13)

| id | st | como |
|---|---|---|
| ARQ-01 | R | Contrato de `storage` exige `import type` para deck e progress |
| ARQ-05 | A | Aceito: 3 telas; a Fase 6 testa a UI com ferramenta de automação de navegador |
| IMP-05 | R | Stores declarados: `reviews` (keyPath `eventId`, índice `cardId`), `deck`, `meta` |
| SCI-01 | R | `INITIAL.i = 0 Days` documentado como decisão de projeto significando "nunca revisado" — não atribuído a Wozniak |
| SCI-02 | R | A ordem canônica é declarada decisão de projeto; a propriedade de G-Set cobre a UNIÃO, não a ordem do replay |
| SEC-03 | A | Progresso em claro no IndexedDB: sem dado sensível (§3 exclui autenticação). Risco declarado |
| SEC-04 | A | Alvo é origem dedicada; declarado |
| REG-03 | R | Campos obrigatórios do manifest enumerados em cache-strategy.md |
| UX-05 | R | `SessionView` carrega `index` e `total` |
| SUS-02 | A | duplica: PERF-02 |
| GOV-03 | D | Acrescentar `appVersion` ao evento mudaria o formato que dois dispositivos precisam acordar. Diferido a v2.0 |
| LING-04 | R | Tipo `Days` com marca |
| MEC-04 | R | Mesmo mecanismo de UX-04: com o botão inerte no estado `writing`, o toque duplo não gera dois eventos |

## Contagem

- 🔴 7: **7 R**, 0 A, 0 D
- 🟡 44: **35 R**, 9 A, 0 D
- 🟢 13: **8 R**, 4 A, 1 D
- **Total: 50 resolvidos, 13 aceitos com justificativa, 1 diferido.**

---

# Iteração 2 — resolução dos 21 achados (V(2) → V(3))

## 🔴 Críticos (3) — todos resolvidos, e todos REMOVENDO regra

| id | st | como |
|---|---|---|
| LING-05 | R | C-10 revisado: `push` renomeado para **`merge`**, e o contrato diz o que o nome promete — o remoto UNE, nunca substitui. Um merge obsoleto passa a ser inofensivo, porque a união é idempotente. A sincronização vira simétrica |
| RES-06 | R | C-8 revisado: a alegação foi REDUZIDA ao que é verdade. Reparo por sincronização só vale entre domínios de falha distintos; o duplo local **não é backup** e não promete durabilidade. Ele existe para exercitar a reconciliação, que é o que a §6 Inc.3 diz importar |
| ASS-06 | R | C-9 revisado: a regra "rejeitar cardId fora do deck" foi **removida**. O log sobrevive a qualquer versão de deck; pertencer ao deck corrente não é critério de validade |

## 🟡 Importantes (14)

| id | st | como |
|---|---|---|
| LING-06 | R | C-18: assinatura única `grade(q) -> Promise<Result<void, WriteError>>`; o cardId vem do estado da sessão |
| ARQ-06 | A | Aceito por simetria: cada módulo valida o SEU próprio tipo — `deck` tem `parseDeck`, `progress` tem `parseReview`. Mover a validação para `sync` acoplaria o adaptador ao domínio |
| ARQ-07 | R | A raiz de composição (`main.ts`) gera o `deviceId`; `storage` apenas guarda. Criar identidade não é persistir |
| UX-07 | R | C-20: controle de sincronização alcançável de qualquer estado da sessão |
| PERF-04 | R | C-14 revisado: `applyOne` no cartão afetado, O(1) por nota, com equivalência ao replay demonstrada pela ordem canônica (+ A-18) |
| SEC-05 | R | C-9: `atEpochMs` rejeitado se estiver mais de 24 h no futuro em relação a quem recebe |
| SCI-03 | R | `nextDueDay` declarado como **aritmética de calendário** sobre a LocalDay, não soma de milissegundos — imune a horário de verão |
| IMP-06 | R | Mecanismo declarado: `postMessage` do service worker para os clientes |
| OBS-04 | R | C-19: consumidor e limiar — consulta na inicialização, aviso acima de 80 % de uso |
| GOV-04 | R | C-17: a sincronia entre documento e config vira **teste** na Fase 6 (o manifesto precisa conter app shell e deck.json). Checagem mecânica, não disciplina |
| PROC-05 | R | C-16: prazo de 5 s no estado `writing`, com transição para `error` |
| MIG-05 | R | C-15 revisado: `DeckRepository.save` a cada carga bem-sucedida garante que o anterior está guardado |
| MEC-05 | R | A-14 revisada: `vite-plugin-pwa` em versão exata e lockfile comitado, porque o Workbox é dependência TRANSITIVA |
| SUS-03 | R | A-7 revisada: o limiar de 50 000 passa a governar o transporte também; ordem de grandeza quantificada (~6 MB por sincronização) |

## 🟢 Sugestões (4)

| id | st | como |
|---|---|---|
| CTRL-03 | R | A-16 revisada: bit-identidade vale pós-sincronização |
| REG-04 | A | Aceito: §7 depende de disciplina na Fase 5, guiada por commit-protocol.md |
| GOV-05 | R | Resolvido junto com RES-06: o duplo local deixou de ser tratado como backup, então o caminho de reinício não destrói promessa alguma |
| MEC-06 | A | Aceito: desempate por UUID é arbitrário **e estável** — estabilidade é exatamente o que a convergência exige |

## Contagem — iteração 2

- 🔴 3: **3 R** · 🟡 14: **12 R, 2 A** · 🟢 4: **2 R, 2 A**
- **17 resolvidos, 4 aceitos, 0 diferidos.**
- Acumulado nas duas iterações: 85 achados, **67 resolvidos, 17 aceitos, 1 diferido**.
