# SM-2 — implementação de referência para port literal (S6 Tier 2)

O agendador é **Tier 2**: algoritmo documentado, a ser portado literalmente — mesma
estrutura, mesmos nomes, testado contra as mesmas entradas. Este arquivo é a fonte
do port. Fonte normativa: REQUISITOS.md §4 (congelada). Fonte histórica:
`specs/references/sm2-original.md`.

## Pseudocódigo normativo (§4, literal)

```
applyReview(n, EF, I, q):
    # ORDEM IMPORTA: o intervalo usa o EF ANTERIOR; só depois o EF é atualizado.
    se q >= 3:
        se n == 0:  I = 1
        senão se n == 1:  I = 6
        senão:      I = round(I * EF)        # round = half-up (D3)
        n = n + 1
    senão:
        n = 0
        I = 1

    EF = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))   # FORA do se/senão (D1)
    EF = max(EF, 1.3)

    devolve (n, EF, I)
```

## Três armadilhas do port — não "consertar" nenhuma

1. **A linha do EF fica FORA do `se/senão`** (D1). O SM-2 original diz
   *"without changing the E-Factor"* em falha; a §4 congelada diz o contrário e
   prevalece. Se a implementação atualizar EF só em acerto, VAL-1.4 falha.
2. **O intervalo usa o EF anterior.** Calcular `I` depois de atualizar o `EF`
   produz números diferentes a partir da terceira revisão.
3. **`round` é half-up** (`Math.round` do JS), não teto e não *banker's rounding*
   (D3). `15 × 2,5 = 37,5 → 38`.

## Estado inicial

`n = 0`, `EF = 2,5`, `I = 0` — `I = 0` significa "nunca revisado"; é convenção deste
projeto, não do original (SCI-01). Cartão nunca revisado está devido imediatamente.

## Vencimento (D4)

`dueDay = dia local da revisão + I dias`, por **aritmética de calendário** sobre a
`LocalDay` (SCI-03) — nunca por soma de `I × 86 400 000` ms, que erra em transição
de horário de verão.
