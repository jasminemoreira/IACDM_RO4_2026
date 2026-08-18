# Vetores de referência do SM-2

Verdade de referência para a Fase 6. **Nenhum valor foi escrito de cabeça:** todos saem da
fórmula publicada em [../references/sm2-wozniak.md](../references/sm2-wozniak.md), com a ordem
de avaliação preservada — `I` é computado com o `EF` vigente **antes** da atualização daquele passo.

Estado inicial de todo cartão: `n=0`, `EF=2.5`, `I=0` (nunca revisado ⇒ devido imediatamente).

### V-1 — trajetoria tipica: 4, 5, 3, 2, 5
| passo | q | n antes | EF antes | I antes | n depois | EF depois | I depois |
|---|---|---|---|---|---|---|---|
| 1 | 4 | 0 | 2.5 | 0 | 1 | 2.5 | 1 |
| 2 | 5 | 1 | 2.5 | 1 | 2 | 2.6 | 6 |
| 3 | 3 | 2 | 2.6 | 6 | 3 | 2.46 | 16 |
| 4 | 2 | 3 | 2.46 | 16 | 0 | 2.14 | 1 |
| 5 | 5 | 0 | 2.14 | 1 | 1 | 2.24 | 1 |

### V-2 — piso do EF: cinco zeros seguidos
| passo | q | n antes | EF antes | I antes | n depois | EF depois | I depois |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 2.5 | 0 | 0 | 1.7 | 1 |
| 2 | 0 | 0 | 1.7 | 1 | 0 | 1.3 | 1 |
| 3 | 0 | 0 | 1.3 | 1 | 0 | 1.3 | 1 |
| 4 | 0 | 0 | 1.3 | 1 | 0 | 1.3 | 1 |
| 5 | 0 | 0 | 1.3 | 1 | 0 | 1.3 | 1 |

### V-3 — acertos perfeitos: 5 x6 (crescimento do intervalo)
| passo | q | n antes | EF antes | I antes | n depois | EF depois | I depois |
|---|---|---|---|---|---|---|---|
| 1 | 5 | 0 | 2.5 | 0 | 1 | 2.6 | 1 |
| 2 | 5 | 1 | 2.6 | 1 | 2 | 2.7 | 6 |
| 3 | 5 | 2 | 2.7 | 6 | 3 | 2.8 | 16 |
| 4 | 5 | 3 | 2.8 | 16 | 4 | 2.9 | 45 |
| 5 | 5 | 4 | 2.9 | 45 | 5 | 3 | 131 |
| 6 | 5 | 5 | 3 | 131 | 6 | 3.1 | 393 |

### V-4 — fronteira q=3 vs q=2 (acerto minimo e falha maxima)
| passo | q | n antes | EF antes | I antes | n depois | EF depois | I depois |
|---|---|---|---|---|---|---|---|
| 1 | 3 | 0 | 2.5 | 0 | 1 | 2.36 | 1 |
| 2 | 3 | 1 | 2.36 | 1 | 2 | 2.22 | 6 |
| 3 | 2 | 2 | 2.22 | 6 | 0 | 1.9 | 1 |
| 4 | 3 | 0 | 1.9 | 1 | 1 | 1.76 | 1 |

## O que cada vetor prova

| Vetor | Prova |
|---|---|
| **V-1** | Trajetória típica. O passo 4 mostra que a falha zera `n` e põe `I=1` **sem** zerar o `EF` — ele apenas cai (2.46 → 2.14). O passo 5 mostra a retomada por `I=1`, não pelo intervalo anterior |
| **V-2** | O piso do `EF`. Cada zero custa 0,8; do 2.5 chega-se ao piso 1.3 em dois passos, e ali fica. Prova que `max(EF, 1.3)` é aplicado **toda** vez, não só na primeira |
| **V-3** | Crescimento do intervalo com acertos perfeitos: 1 → 6 → 16 → 45 → 131 → 393 dias. O passo 3 é o teste da ordem: `round(6 × 2.7) = 16`, usando o `EF` já atualizado no passo 2 e **não** o do passo 3 |
| **V-4** | A fronteira de `q`. `q=3` é acerto (avança `n`, mas derruba o `EF` em 0,14); `q=2` é falha (zera `n`, `I=1`, derruba o `EF` em 0,32). Um cartão pode avançar e ficar mais difícil ao mesmo tempo |
