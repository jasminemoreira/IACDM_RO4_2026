# Vetores de teste do SM-2 — verdade fundamental para a Fase 6

Calculados à mão a partir de REQUISITOS.md §4. **Não derivados de implementação
alguma** — é isso que os torna capazes de pegar o código, em vez de reafirmá-lo.

## Progressão de acertos (q = 4, que não move o EF)

| # | entrada (n, EF, I) | q | saída (n, EF, I) | o que trava |
|---|---|---|---|---|
| V1 | 0, 2,50, 0 | 4 | 1, 2,50, **1** | primeira revisão: I = 1 |
| V2 | 1, 2,50, 1 | 4 | 2, 2,50, **6** | segunda revisão: I = 6 |
| V3 | 2, 2,50, 6 | 4 | 3, 2,50, **15** | 6 × 2,5 = 15 |
| V4 | 3, 2,50, 15 | 4 | 4, 2,50, **38** | 15 × 2,5 = 37,5 → **half-up** (D3). Teto daria 38 também, mas *banker's rounding* daria 38 e truncar daria 37 — este vetor distingue truncamento |
| V5 | 4, 2,50, 38 | 4 | 5, 2,50, **95** | 38 × 2,5 = 95 |

q = 4 deixa o EF intacto: `(5−4)=1`, `0,08+0,02=0,10`, `0,1−0,10=0`.

## Efeito da nota sobre o EF (a partir de EF = 2,50)

| # | q | EF resultante | conta |
|---|---|---|---|
| V6 | 5 | **2,60** | `0,1 − 0×(…) = +0,10` |
| V7 | 4 | **2,50** | `0,1 − 1×0,10 = 0` |
| V8 | 3 | **2,36** | `0,1 − 2×0,12 = −0,14` |
| V9 | 2 | **2,18** | `0,1 − 3×0,14 = −0,32` |
| V10 | 1 | **1,96** | `0,1 − 4×0,16 = −0,54` |
| V11 | 0 | **1,70** | `0,1 − 5×0,18 = −0,80` |

V9, V10 e V11 são o teste de D1: **q < 3 também move o EF**. Uma implementação
fiel ao SM-2 original devolveria 2,50 nos três e falharia aqui.

## Falha em cartão maduro

| # | entrada | q | saída | o que trava |
|---|---|---|---|---|
| V12 | 3, 2,50, 15 | 0 | **0, 1,70, 1** | `n` zera, `I` volta a 1 **e o EF cai** (D1) |
| V13 | 5, 2,50, 95 | 2 | **0, 2,18, 1** | q = 2 ainda é falha |

## Piso e recuperação (CTRL-01 — windup assimétrico)

| # | sequência a partir de EF = 2,50 | EF ao final |
|---|---|---|
| V14 | q=0 | 1,70 |
| V15 | q=0, q=0 | **1,30** (0,90 seria o valor bruto; o piso corta) |
| V16 | q=0, q=0, q=0 | **1,30** (fica preso) |
| V17 | q=0, q=0, q=0, q=5 | **1,40** (recupera +0,10 contra quedas de −0,80) |

V17 é o vetor que **documenta** o windup aceito em CTRL-01: não é defeito, é o
comportamento da §4 congelada.

## Vencimento (D4, aritmética de calendário)

| # | dia local da revisão | I | dueDay esperado |
|---|---|---|---|
| V18 | 2026-08-18 | 1 | 2026-08-19 |
| V19 | 2026-08-18 | 6 | 2026-08-24 |
| V20 | 2026-02-25 | 6 | 2026-03-03 (2026 não é bissexto) |
| V21 | 2024-02-25 | 6 | 2024-03-02 (2024 é bissexto) |
| V22 | 2026-12-30 | 15 | 2027-01-14 (vira o ano) |

V20/V21 travam a aritmética de calendário; V22 trava a virada de ano.
