# SM-2 — fonte canônica e divergência declarada

**Fonte primária.** P. A. Woźniak, *Optimization of learning*, Master's Thesis,
University of Technology in Poznań, 1990. Descrição do "Algorithm SM-2" publicada em
<https://super-memory.com/english/ol/sm2.htm> (verificado 2026-08-18).
Contexto histórico e do E-Factor: <https://www.supermemo.com/en/blog/optimization-of-learning>.

## Texto do algoritmo, como publicado

Intervalos:

> `I(1):=1, I(2):=6, for n>2: I(n):=I(n-1)*EF`

onde `I(n)` é o número de dias entre repetições e `EF` o *easiness factor*.

Atualização do E-Factor:

> `EF':=EF+(0.1-(5-q)*(0.08+(5-q)*0.02))`

Valor inicial e piso:

> "With all items associate an E-Factor equal to 2.5."
> "If EF is less than 1.3 then let EF be 1.3."

Escala de qualidade `q` (0–5), como publicada:

| q | significado |
|---|---|
| 5 | resposta perfeita |
| 4 | correta, com hesitação |
| 3 | correta, com dificuldade séria |
| 2 | incorreta; a resposta correta pareceu fácil ao ser lembrada |
| 1 | incorreta; a resposta correta foi lembrada |
| 0 | branco total |

Tratamento de falha, como publicado:

> "If the quality response was lower than 3 then start repetitions for the item from the
> beginning" — e repetir, **na mesma sessão**, todos os itens que pontuaram abaixo de 4.

## Conferência contra REQUISITOS.md §4

| Elemento | Fonte canônica | REQUISITOS.md §4 | Igual? |
|---|---|---|---|
| I para n==0 | `I(1)=1` | `I = 1` | ✅ |
| I para n==1 | `I(2)=6` | `I = 6` | ✅ |
| I para n≥2 | `I(n)=I(n-1)*EF` | `round(I_anterior * EF)` | ✅ (§4 fixa o arredondamento, que a fonte deixa implícito) |
| EF inicial | 2,5 | 2,5 | ✅ |
| Fórmula do EF | `EF+(0.1-(5-q)*(0.08+(5-q)*0.02))` | idêntica | ✅ |
| Piso do EF | 1,3 | `max(EF, 1.3)` | ✅ |
| Escala de q | 0–5 | 0–5 | ✅ |
| Falha (q<3) | zera repetições **e reapresenta na mesma sessão** | `n = 0; I = 1` — nada sobre a sessão | ⚠️ **DIVERGÊNCIA** |

## Divergência declarada (decisão do operador, Fase 0)

O SM-2 original reapresenta o item dentro da mesma sessão até `q≥4`. A §4 do documento
congelado **não descreve** essa fila intra-sessão: escreve apenas `n = 0; I = 1`, o que
coloca o cartão como devido no dia seguinte, fora da sessão corrente.

**Decisão registrada: vale a leitura literal da §4.** Falha remove o cartão da sessão
corrente. Justificativa: a §4 é normativa e proíbe explicitamente substituições e variantes
"simplificadas"; acrescentar a fila intra-sessão seria acrescentar comportamento que o
requisito congelado não pede.

**Consequência aproveitada como invariante:** uma sessão apresenta cada cartão devido no
máximo uma vez, logo termina em no máximo `|devidos no início|` apresentações. O critério
"uma sessão pode ser concluída do início ao fim" (I1) passa a valer por construção, sem
depender de heurística de parada.

## Ordem de avaliação — importa

A fonte e a §4 atualizam `EF` **depois** de computar `I`. Portanto `I = round(I_anterior * EF_anterior)`,
nunca com o EF já atualizado. A implementação deve preservar essa ordem literalmente.
