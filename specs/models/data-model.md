# Modelo de dados

Tipos do domínio, esquema de armazenamento e formatos de fronteira. Os tipos carregam as
invariantes — Domain Model em estilo funcional.

## Tipos do domínio (núcleo puro)

```ts
// deck — entrada imutável, formato exato da §5
type CardId = string;
type Card   = { id: CardId; hanzi: string; pinyin: string; gloss: string };
type Deck   = { version: string; cards: readonly Card[] };
// `version` NÃO vem do arquivo (a §5 é um array puro): é derivada por hash do conteúdo canônico

// scheduler — estado derivado, nunca fonte de verdade
type Grade = 0 | 1 | 2 | 3 | 4 | 5;
type SchedulingState = {
  n: number;                    // repetições consecutivas com q>=3
  ef: number;                   // easiness factor, inicial 2.5, piso 1.3
  interval: number;             // dias
  lastReviewedAt: number | null // epoch ms; null = nunca revisado
};

// review-log — O FATO. Só isto é persistido e transmitido
type ReviewEvent = {
  eventId: string;   // `${replicaId}:${at}` — único por réplica; a união deduplica por ele
  cardId: CardId;
  q: Grade;
  at: number;        // epoch ms, MONOTÔNICO por réplica: max(agora, últimoAt + 1)
  replicaId: string; // identidade do dispositivo, gerada uma vez e persistida
};

// session — efêmera, nunca persistida
type Session = {
  fila: readonly CardId[];  // devidos apurados na abertura, ordem determinística
  cursor: number;
  revelado: boolean;
};
```

### Invariantes

| # | Invariante | Onde é imposta |
|---|---|---|
| I-1 | `ef >= 1.3` sempre, após toda atualização | `scheduler.applyGrade` |
| I-2 | `q` inteiro em `[0,5]`; fora disso é rejeitado na fronteira | `session.grade`, `server` |
| I-3 | `at` estritamente crescente dentro de uma réplica | `review-log.nextTimestamp` |
| I-4 | `eventId` único; reenviar o mesmo evento é no-op | `review-log.merge` |
| I-5 | Nenhum evento é editado ou removido, nunca | `storage` (append-only) |
| I-6 | `SchedulingState` nunca é persistido nem transmitido como verdade | fronteiras de `storage` e `sync` |
| I-7 | `lastReviewedAt = null` ⇒ devido imediatamente | `scheduler.dueAt` |

## Armazenamento local (IndexedDB, por trás da porta Repository)

| Store | Chave | Conteúdo | Notas |
|---|---|---|---|
| `events` | `eventId` | `ReviewEvent` | Append-only. Índice por `at` para leitura ordenada |
| `meta` | chave textual | `replicaId`, `deckVersion`, `lastSyncedAt` | Escrita rara |

Não há store para `SchedulingState`: ele é recomputado por dobra do log a cada carga (A-6
sustenta o custo). Guardá-lo criaria uma segunda fonte de verdade — exatamente a falha que
o desenho evita.

## Fronteira HTTP (endpoint JSON, M-10)

```
GET  /events?since=<at>   ->  200  { events: ReviewEvent[] }
POST /events              <-       { events: ReviewEvent[] }
                          ->  200  { accepted: number }
```

Semântica: `POST` é **união**, nunca substituição — reenviar eventos já conhecidos é no-op
por `eventId` (I-4), o que torna o envio seguro para repetir após falha de rede.
`since` é otimização de tráfego, não de correção: pedir tudo (`since=0`) produz o mesmo
estado resolvido.

O servidor **não** interpreta `q` nem recomputa SM-2 — ele guarda e devolve eventos.
Toda a lógica de agendamento vive no núcleo puro, executada igualmente nas duas réplicas.
Consequência: o servidor não tem opinião sobre conflito, porque no desenho **não existe
conflito a arbitrar** — existe união a propagar.

## Migração de versão do deck

Não move progresso. Ao detectar `versionOf(deckNovo) != deckVersion` guardado:

| Situação do `id` | Efeito |
|---|---|
| Presente nas duas versões | Nada a fazer — o log já é indexado por `id` |
| Ausente na nova | Eventos **retidos**; o `id` sai do conjunto ativo e não entra em sessão |
| Novo na nova | Sem eventos ⇒ `n=0, EF=2.5`, devido imediatamente |
| Conteúdo editado, mesmo `id` | Nada a fazer — `id` é a identidade |

Se um `id` retido reaparecer numa versão futura, seu progresso ressuscita intacto: nunca foi
apagado. Dados de exercício em [../datasets/README.md](../datasets/README.md).
