# Reconciliação de estado divergente — opções e trade-offs

**Fontes:**
- *Vector Clocks and Conflicting Data* —
  https://medium.com/@apurvaagrawal_95485/vector-clocks-and-conflicting-data-05391d96d0a9
- *CRDTs and Local-First Architecture* —
  https://dev.to/smallstack/crdts-and-local-first-architecture-how-smallstack-handles-offline-conflict-resolution-338c
- *Real-Time Data Sync in Distributed Systems: CRDT, OT, and Event Sourcing* —
  https://www.askantech.com/real-time-data-sync-distributed-systems-crdt-operational-transform-event-sourcing/
- Anki Manual, *Syncing with AnkiWeb* — https://docs.ankiweb.net/syncing.html
(Recuperado em 2026-08-18.)

## Requisito que a escolha precisa satisfazer

REQUISITOS.md §6, Incremento 3 — aceitação:
1. resolução **definida e documentada** para dois estados locais divergentes;
2. **nenhum dos dois lados perde revisões já registradas**;
3. comportamento sob conflito **reproduzível a partir de um cenário descrito**.

O item (2) é o discriminante: qualquer esquema que descarte um dos lados falha.

## Opções

### A. Last-Write-Wins (LWW) sobre o ESTADO do cartão
Cada cartão guarda `{n, EF, I, updatedAt}`; vence o `updatedAt` maior.
- Simples de implementar; O(1) por cartão.
- **Viola o item (2)**: a revisão do lado perdedor é descartada — é exatamente o
  caso clássico ("vinte minutos de trabalho sobrescritos por um relógio adiantado").
- Depende de relógio de parede, sujeito a *clock skew*.

### B. União de log de revisões + replay determinístico (event sourcing)
Cada revisão é um evento imutável `{cardId, q, timestamp, deviceId}` num log
append-only. Sincronizar = **unir os dois logs** (união de conjuntos) e
**recomputar** `{n, EF, I}` aplicando a §4 na ordem canônica.
- O log é um **G-Set** (grow-only set) — um CRDT: união é comutativa,
  associativa e idempotente, logo converge sem coordenação.
- Satisfaz (2) por construção: nenhuma revisão é descartada, todas entram no replay.
- Satisfaz (3): dado o mesmo par de logs, o resultado é idêntico — reproduzível.
- Custo: replay é O(revisões do cartão); exige ordem total determinística
  (desempate por `timestamp`, depois por `deviceId`/`eventId` para eventos
  simultâneos).
- É a forma do que Anki faz: revisões vivem num `revlog` append-only e são
  mescláveis entre dispositivos.

### C. Vector clocks / version vectors
Contadores lógicos por dispositivo detectam concorrência real (em vez de
adivinhar por timestamp), mas **detectam** o conflito — não dizem como resolvê-lo.
Precisam de uma regra de merge por cima (que recai em A ou B).
- Útil se for preciso distinguir "concorrente" de "sucessor" sem confiar em relógio.
- Custo: metadados por cartão por dispositivo.

### D. CRDT de estado genérico (Yjs/Automerge)
Sobrecarga de biblioteca e de modelo desproporcional para `{n, EF, I}` derivável.

## Observação decisiva

`{n, EF, I}` são uma **função pura** do histórico de revisões pela §4. Não são
estado independente: são estado *derivado*. Sincronizar o derivado (opção A) é o
que perde informação; sincronizar o histórico (opção B) não pode perder, porque
o histórico é o dado primário.

A decisão formal pertence à Fase 1 — este documento apenas estabelece o campo de
opções com fonte.
