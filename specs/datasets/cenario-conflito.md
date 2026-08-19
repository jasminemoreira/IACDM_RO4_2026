# Cenário de conflito reproduzível (§6 Inc.3)

A §6 Inc.3 exige que "o comportamento sob conflito seja reproduzível a partir de um
cenário descrito". Este é o cenário. Rodá-lo duas vezes deve dar resultado idêntico.

## Estado inicial (ambos os dispositivos sincronizados)

Deck com 3 cartões: `c001`, `c002`, `c003`. Nenhuma revisão. `deviceId` de A =
`aaaa…`, de B = `bbbb…` (UUIDs fixos no teste, não gerados).

## Divergência offline

**Dispositivo A**, em 2026-08-18, sem rede:
| evento | cardId | q | atEpochMs | localDay |
|---|---|---|---|---|
| e1 | c001 | 4 | 1 787 000 000 000 | 2026-08-18 |
| e2 | c002 | 5 | 1 787 000 060 000 | 2026-08-18 |

**Dispositivo B**, no mesmo dia, sem rede:
| evento | cardId | q | atEpochMs | localDay |
|---|---|---|---|---|
| e3 | c001 | 0 | 1 787 000 030 000 | 2026-08-18 |
| e4 | c003 | 3 | 1 787 000 090 000 | 2026-08-18 |

`c001` foi revisado **nos dois** — é o conflito. A deu 4, B deu 0, e a revisão de B
aconteceu **entre** as duas de A.

## Resolução esperada (união + replay em ordem canônica)

Ordem canônica por `atEpochMs`: **e1 (A, c001, q=4) → e3 (B, c001, q=0) → e2 → e4**.

Estado de `c001` após o replay:
1. e1: (0, 2,50, 0) + q=4 → (1, 2,50, 1)
2. e3: (1, 2,50, 1) + q=0 → **(0, 1,70, 1)**

| cartão | estado final | vindo de |
|---|---|---|
| c001 | n=0, EF=1,70, I=1 | e1 e e3, nesta ordem |
| c002 | n=1, EF=2,60, I=1 | e2 |
| c003 | n=1, EF=2,36, I=1 | e4 |

**Log final: 4 eventos nos dois dispositivos.** Nenhum descartado — é a verificação
literal de "nenhum dos dois lados perde revisões já registradas".

## O que o cenário prova

- **Convergência:** A←B e B←A produzem o mesmo estado (VAL-3.5).
- **Sem perda:** 2 + 2 = 4 eventos de cada lado depois (VAL-3.2).
- **Não é LWW:** last-write-wins sobre o estado do cartão descartaria e1 ou e3 e
  daria (1, 2,50, 1) ou (0, 1,70, 1) conforme o relógio — e perderia uma revisão.
- **Idempotência:** sincronizar de novo, sem revisões novas, não muda nada (C-5).
- **Independência de fuso:** reconciliar com o dispositivo em qualquer fuso dá o
  mesmo resultado, porque `localDay` foi gravado por quem revisou (A-10, VAL-3.4).

## Variante de borda (EDGE-4)

Repetir com `e1.atEpochMs == e3.atEpochMs`: o desempate cai em `deviceId`, e
`aaaa… < bbbb…` põe e1 antes de e3 — mesmo estado final, agora por regra
declarada e não por acaso.
