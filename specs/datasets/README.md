# Conjuntos de dados

## `deck-v1.json` / `deck-v2.json`

Deck de entrada no formato exato da §5 de REQUISITOS.md — **array puro de cartões**,
sem invólucro e sem campo de versão. Vocabulário de faixa HSK 1.

| | v1 | v2 |
|---|---|---|
| Cartões | 50 | 52 |
| sha256 (16 primeiros) | `b7557b204dba5332` | `79bec7ed2d430f1d` |

### Delta v1 → v2 — construído para exercitar os três casos da migração

| Caso | ids | O que deve acontecer com o progresso |
|---|---|---|
| **Removidos** | `c048` 茶, `c049` 米饭, `c050` 苹果 | Retido e inativo. Não entra em sessão. Ressuscita intacto se o id voltar |
| **Editados (mesmo id)** | `c002` pinyin `xièxie`→`xiè xie`; `c013` gloss reescrito; `c045` pinyin `Zhōngguó`→`zhōngguó` | Mantido integralmente — `id` é a identidade |
| **Adicionados** | `c051`…`c055` | Entram como novos: `n=0`, `EF=2.5`, devidos imediatamente |

Os três casos foram escolhidos como edições **realistas** (normalização de pinyin,
capitalização, gloss mais preciso), não como mutações artificiais: é assim que uma versão
de deck muda de verdade, e é essa a situação em que perder progresso seria inaceitável.

## Nota de forma — de onde vem a "versão do deck"

A §5 fixa o formato como array puro. **Não há campo de versão no arquivo**, e acrescentar
um invólucro `{version, cards}` seria desviar do formato congelado. Portanto o identificador
de versão do modelo de conteúdo (exigido pelo critério 4 do I2) tem de ser **derivado ou
atribuído fora do arquivo** — por exemplo o hash do conteúdo canônico, que é determinístico,
não exige mudança de formato e detecta a troca sozinho. A escolha do mecanismo é da Fase 1;
o que a Fase 0 fixa é a restrição: **o formato da §5 não pode ser alterado para acomodar a versão**.

## Vetores de teste do SM-2

A produzir na Fase 6, conferidos contra [../references/sm2-wozniak.md](../references/sm2-wozniak.md).
Regra: nenhum valor esperado escrito de cabeça — cada vetor sai da fórmula publicada,
com a ordem de avaliação preservada (`I` computado com o `EF` **anterior**).
