# Entidades do domínio (Nível 3 da HSA — refinado na Fase 1)

Identificado em P0. A modelagem formal (tipos, contratos, onde cada uma vive)
pertence à Fase 1.

| Entidade | Natureza | Origem | Muda? |
|---|---|---|---|
| **Cartão** | conteúdo `{id, hanzi, pinyin, gloss}` (§5, congelado) | deck.json | imutável dentro de uma versão do deck |
| **Deck** | coleção de cartões + versão | arquivo estático servido pelo app | trocado por nova versão (migração) |
| **Revisão** | evento `{cardId, q, timestamp, diaLocal, deviceId}` | ato do usuário | **append-only, imutável** |
| **Estado do cartão** | `{n, EF, I, due}` | **derivado** das revisões pela §4 | recomputável |
| **Progresso** | conjunto de revisões + estados derivados | local (IndexedDB) | cresce |

## Invariante central descoberta em P0

> `{n, EF, I}` é **função pura** do histórico de revisões daquele cartão, dado o
> algoritmo congelado da §4.

Consequências que atravessam os três incrementos:
1. O dado **primário** é a revisão; o estado do cartão é *cache* de um cálculo.
2. Persistir (Inc.2) e sincronizar (Inc.3) o dado primário nunca perde
   informação; persistir só o derivado perde.
3. "Nenhum dos dois lados perde revisões já registradas" (§6 Inc.3) só é
   verificável se as revisões existirem como entidades contáveis.
4. A migração de deck (Inc.2) preserva progresso de cartões removidos porque o
   histórico de revisões não depende do deck corrente.
