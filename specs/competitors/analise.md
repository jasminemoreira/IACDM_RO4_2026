# Produtos comparáveis (estado da arte)

Recuperado em 2026-08-18.

| Produto | Algoritmo | Offline | Sync / conflito | Lição para este projeto |
|---|---|---|---|---|
| **Anki / AnkiDroid** | SM-2 mutado (hoje também FSRS) | app nativo, coleção local | `revlog` append-only mesclável entre dispositivos; timestamp desempata; "full sync" quando não dá para mesclar (https://docs.ankiweb.net/syncing.html) | Confirma a viabilidade da união de log de revisões como base do merge |
| **Mnemosyne** | SM-2 direto | local | log de eventos científico (o projeto coleta o log para pesquisa) | O log de revisões é o dado primário; o estado do cartão é derivado |
| **Duolingo** | modelo próprio (half-life regression) | parcial | servidor autoritativo | Fora do padrão SM-2; não é referência aqui |
| **Pleco** | SRS para chinês, deck fechado | sim | manual/arquivo | Domínio idêntico (hanzi/pinyin/gloss); confirma o modelo de conteúdo da §5 |

**Gap explorado por este projeto:** SRS de chinês, offline-first de verdade
(partida a frio offline), com reconciliação de conflito *documentada e
reproduzível* — Anki resolve na prática mas o comportamento sob conflito não é
especificado publicamente de forma reproduzível.

Fontes: https://docs.ankiweb.net/syncing.html ; https://forums.ankiweb.net/t/debugging-sync-conflicts/25714
