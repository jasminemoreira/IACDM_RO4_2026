# SM-2 — especificação original (Wozniak)

**Fonte primária:** P. A. Wozniak, *Optimization of learning*, Master's Thesis,
University of Technology in Poznan, 1990.
Texto online: https://super-memory.com/english/ol/sm2.htm
Espelho oficial: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
(Recuperado em 2026-08-18.)

Algoritmo usado nos programas SuperMemo 1.0–3.0 entre 1987-12-13 e 1989-03-09.

## Fórmulas originais (citação literal)

Intervalos entre repetições, em dias:

```
I(1) := 1
I(2) := 6
para n > 2:  I(n) := I(n-1) * EF
```

Atualização do E-Factor:

```
EF' := EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
```

Piso do E-Factor: *"If EF is less than 1.3 then let EF be 1.3."*
E-Factor inicial de todo item: **2.5**.

## Escala de qualidade q (0–5), literal da fonte

| q | significado |
|---|-------------|
| 5 | perfect response |
| 4 | correct after hesitation |
| 3 | correct with serious difficulty |
| 2 | incorrect; correct seemed easy |
| 1 | incorrect; correct remembered |
| 0 | complete blackout |

## Duas regras do original NÃO presentes em REQUISITOS.md §4

1. **EF não é alterado em falha.** O original: *"If the quality response was lower
   than 3 then start repetitions for the item from the beginning ... without
   changing the E-Factor."* REQUISITOS.md §4 escreve a linha de EF FORA do
   if/else — ou seja, atualiza EF também quando q < 3.
2. **Re-revisão na mesma sessão.** O original: *"After each repetition session
   repeat all items that scored below four in quality assessment"* até todos
   atingirem ≥ 4. REQUISITOS.md §4 não menciona isso.

Ver `specs/technical/sm2-divergencias.md` para o tratamento decidido. Os
requisitos estão CONGELADOS: o texto da §4 prevalece sobre o original — este
arquivo existe para que a divergência seja consciente e não seja "corrigida"
por engano durante a implementação.
