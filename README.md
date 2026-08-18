# Hanzi — PWA de revisão espaçada

Implementação do brief em [REQUISITOS.md](REQUISITOS.md). Os requisitos estão congelados;
este documento descreve o que já foi construído.

**Estado: Incrementos 1 e 2 entregues.** O Incremento 3 ainda não começou.

## Como rodar

```bash
npm install
npm run dev        # servidor de desenvolvimento (sem service worker)
npm test           # suíte de testes
npm run typecheck  # checagem de tipos da aplicação e do service worker
npm run build      # checagem de tipos + build de produção
npm run preview    # serve o build; é aqui que o service worker existe
```

O service worker só é registrado no build de produção — em desenvolvimento ele
atrapalharia o *hot reload* e não há arquivos finais para pré-cachear. Para exercitar
o modo offline, use `npm run build && npm run preview`.

## Estrutura

Módulos são diretórios de primeiro nível sob `src/`, cada um com `index.ts` como único
ponto de entrada. Nenhum módulo importa arquivos internos de outro.

| Módulo | Responsabilidade | Depende de |
| --- | --- | --- |
| `src/deck/` | formato do conteúdo (§5), validação, versão e catálogo de entrada | — |
| `src/scheduler/` | SM-2 (§4) e seleção de cartões devidos | — |
| `src/session/` | laço de revisão e progresso em memória | `deck`, `scheduler` |
| `src/storage/` | modelo persistido versionado, migração e depósito local | `deck`, `scheduler`, `session` |
| `src/pwa/` | service worker, estratégia de cache e registro | — |
| `src/ui/` | tela e desenho em DOM | `deck`, `scheduler` (só tipos) |
| `src/app/` | composição, estado da aplicação e bootstrap | todos |

Os decks de entrada ficam em [decks/](decks/), no formato da §5. A aplicação apenas os
lê: não cria nem edita conteúdo.

O fluxo é unidirecional. `src/app/estado.ts` guarda o estado, deriva uma `Tela` e a
entrega a `renderizar`; a `ui` não conhece o domínio nem toca no agendador.

## Incremento 1 — núcleo de revisão

### Decisões

O pseudocódigo da §4 admite duas leituras, fixadas assim — ambas cobertas por teste:

1. **O novo intervalo usa o `EF` anterior.** A linha `I = round(I_anterior * EF)` precede a
   atualização de `EF` no pseudocódigo, então é o `EF` de antes que entra no cálculo.
2. **`EF` é atualizado nos dois ramos**, acerto e erro, porque a linha está fora do `se`.

Outras decisões:

3. **A fila da sessão é fixada no início.** `iniciarSessao` calcula os cartões devidos
   naquele instante e cada um é respondido uma única vez, o que garante que toda sessão
   termina. Um cartão com `q < 3` **não** reentra na fila da sessão corrente: o próprio
   SM-2 já o reagenda para o dia seguinte (`I = 1`).
4. **Cartão nunca revisado tem `proximaRevisao = null`** e está devido desde sempre. A
   ordem da fila é determinística: novos primeiro, depois prazo mais antigo, desempate por id.
5. **Todo o estado é imutável.** `revisar`, `responder` e afins devolvem novos valores,
   nunca alteram o que recebem.
6. **Nota inválida é erro, não silêncio.** `revisar` rejeita `q` fora de 0..5 inteiro,
   assim como `parseDeck` rejeita deck malformado.

### Aceitação

| Critério | Onde está |
| --- | --- |
| o agendador apresenta apenas os cartões devidos | `src/scheduler/devidos.ts`, `src/session/sessao.ts` |
| `q` é registrada e o intervalo recomputado conforme a §4 | `src/scheduler/sm2.ts` |
| uma sessão pode ser concluída do início ao fim | `src/session/sessao.ts` |

## Incremento 2 — offline e persistência

### Estratégia de cache — declarada

O service worker está em [src/pwa/sw.ts](src/pwa/sw.ts); as decisões de rota, isoladas
para teste, em [src/pwa/estrategia.ts](src/pwa/estrategia.ts).

**Precache completo do app shell, cache-first, sem revalidação em runtime.**

| Evento | Comportamento |
| --- | --- |
| `install` | abre o cache `hanzi-<versão-do-build>` e guarda **todos** os arquivos emitidos pelo build. Depois disso a aplicação inteira está no disco. Em seguida `skipWaiting()`. |
| `activate` | apaga todo cache `hanzi-*` que não seja o deste build e chama `clients.claim()`. |
| `fetch` — navegação | responde sempre `/index.html` do cache. É isto que faz a partida a frio offline funcionar, inclusive com `?deck=…` na URL. |
| `fetch` — GET de mesma origem | cache primeiro; só se faltar, rede; se a rede também falhar, `503`. |
| `fetch` — resto | outro método ou outra origem passa direto à rede e **nunca** é cacheado. É por aqui que a sincronização do Incremento 3 sairá. |

A lista de precache **não é escrita à mão**: o plugin `hanzi-precache` em
[vite.config.ts](vite.config.ts) a injeta a partir do bundle real, e deriva dela a versão
do cache. Um arquivo novo entra sozinho; um arquivo removido sai sozinho; e um build novo
sempre produz um cache novo, então nunca se serve conteúdo obsoleto. Se os marcadores não
forem encontrados no worker, o build falha em vez de publicar um precache vazio.

O conteúdo dos decks é empacotado no bundle, não buscado em runtime — offline não há
requisição alguma a fazer.

### Persistência

`IndexedDB` (banco `hanzi`, loja `estado`, chave `atual`), com queda para um depósito em
memória quando o navegador nega armazenamento — nesse caso a interface mostra a marca
*sem persistência* em vez de fingir que gravou. O progresso é gravado após cada nota.

### Modelo de conteúdo versionado

São **duas versões independentes**, e vale distinguir:

- **`versaoModelo`** — a forma do registro guardado localmente. Ao mudar essa forma,
  incrementa-se `VERSAO_MODELO` e registra-se a migração correspondente em `MIGRACOES`
  (`src/storage/modelo.ts`); `aplicarMigracoes` encadeia os degraus na leitura. Hoje está
  na versão 1, então o mapa está vazio — o mecanismo, esse sim, é testado.
- **`versao` do deck** — derivada do conteúdo dos cartões, porque a §5 está congelada e
  não tem campo de versão. Qualquer alteração em qualquer campo produz uma versão nova,
  o que é o que permite detectar a troca.

**Migração numa troca de versão do deck** (`src/storage/migracao.ts`), pela identidade
`id` da §5:

| Situação | O que acontece |
| --- | --- |
| cartão continua no deck | mantém o estado SM-2 intacto, mesmo se hanzi/pinyin/gloss mudaram |
| cartão novo no deck | começa com estado inicial, e portanto devido |
| cartão saiu do deck | o progresso é **arquivado em `orfaos`**, nunca apagado |
| cartão arquivado volta ao deck | recupera exatamente o progresso que tinha |

Um registro local **ilegível** — corrompido, ou de um modelo mais novo que o suportado —
não é descartado: é copiado para a chave `ilegivel:<instante>` e a aplicação avisa na tela
antes de começar do zero.

Limite assumido e documentado: se o `id` de um cartão muda entre versões, ele é outro
cartão. Não há como reconciliar isso sem inventar conteúdo, e o progresso antigo fica
arquivado em vez de perdido.

### Cenário reproduzível da migração

```bash
npm run build && npm run preview
```

1. Abra `/`, responda alguns cartões — inclusive `c011` (o 11º da fila).
2. No seletor do cabeçalho, escolha **HSK básico revisado** (ou abra `/?deck=exemplo-v2`).
3. O aviso informa: *11 com progresso preservado, 2 novo(s), 1 arquivado(s) sem perda*.
   `c011` sai do deck, `c013` e `c014` entram, `c003` muda de *gloss* mas mantém o progresso.
4. Volte para **HSK básico**: `c011` reaparece com o mesmo `n`, `EF` e prazo de antes.

### Aceitação

| Critério | Onde está |
| --- | --- |
| service worker registrado, com estratégia de cache declarada por escrito | `src/pwa/`, e a tabela acima |
| partida a frio **offline** funciona | precache do app shell + navegação servida da casca |
| deck e progresso persistem localmente e sobrevivem a recarga | `src/storage/`, IndexedDB |
| troca de versão do deck migra o progresso sem perda | `src/storage/migracao.ts` |

## Verificação

`npm test` cobre o domínio: SM-2 campo a campo, seleção de devidos, laço de sessão,
modelo persistido, cadeia de migrações, troca de versão de deck e rotas de cache.

O comportamento de navegador — registro do service worker, conteúdo real do cache,
partida a frio offline, sobrevivência a recarga e a migração ponta a ponta — é verificado
num Chromium headless com scripts que ficam **fora do repositório**, para que o
instrumento não entre na medição do projeto (ver `.gitignore`).

## Fora de escopo

Por decisão do brief (§3), e portanto ausentes: áudio, ordem de traços, autoria de lições,
autenticação.

## Uso

Espaço ou Enter revela a resposta; as teclas `0`–`5` registram a nota. Os mesmos comandos
estão disponíveis por clique. O seletor no cabeçalho troca o deck de entrada.
