# SM-2: divergências e pontos indeterminados de REQUISITOS.md §4

O texto da §4 está CONGELADO e prevalece. Este arquivo registra (a) onde ele
diverge conscientemente do original e (b) o que ele não determina e portanto
precisa de decisão do operador antes da implementação.

Referência do original: `specs/references/sm2-original.md`.

## D1 — EF é atualizado também quando q < 3 (divergência do original)

§4 põe as duas linhas de EF FORA do `se q >= 3 / senão`, logo o EF cai também na
falha. O SM-2 original diz explicitamente *"without changing the E-Factor"*.

**Tratamento:** seguir a §4 (congelada). Consequência: um cartão falhado
repetidamente decai o EF até o piso 1.3 mais rápido que no SuperMemo original.
Registrar como premissa numerada na arquitetura para que a implementação não
"conserte" isso para o original.

## D2 — Sem re-revisão na mesma sessão (ausência do original)

O original repete, ao fim da sessão, todo item com q < 4 até que atinja ≥ 4. §4
não menciona. Como §6 Inc.1 aceita *"o agendador apresenta apenas os cartões
devidos"* e um cartão falhado recebe I = 1 (dia), ele volta apenas no dia
seguinte.

**Indeterminado:** um cartão com q < 3 reaparece na sessão corrente? → decisão
do operador em P0.

## D3 — Semântica de `round`

§4 escreve `I = round(I_anterior * EF)`. Não define o desempate de .5 nem o piso.
- `Math.round` em JS arredonda .5 para +∞ (half-up), não é *banker's rounding*.
- O original manda arredondar intervalos fracionários **para cima**.
- Com EF ≥ 1.3 e I ≥ 1, o produto nunca é < 1, então não há risco de I = 0 por
  arredondamento, exceto se `round` fosse aplicado a algo < 0.5.

**Indeterminado:** half-up (`Math.round`) ou teto (`Math.ceil`)? → decisão em P0.

## D4 — Estado inicial e noção de "devido"

§4 dá EF inicial 2.5 e diz que o cartão guarda `n` e `I`, mas não define:
- o `n` e o `I` de um cartão nunca revisado (presumivelmente n = 0);
- **a data de vencimento**: a §4 produz um INTERVALO em dias, não uma data. O que
  se compara com "hoje" para decidir se o cartão está devido?
- se um cartão novo está devido imediatamente.

**Indeterminado:** como o intervalo vira vencimento (timestamp exato da revisão +
I×24h, ou início do dia local + I dias) e o que torna um cartão novo devido
→ decisão em P0. Isso afeta diretamente a testabilidade (§6 Inc.1) e a
reconciliação (§6 Inc.3), porque uma comparação por dia local depende de fuso.

## D5 — Domínio de q

§4 diz "a nota q vai de 0 a 5". Não diz se todos os seis valores são
apresentáveis ao usuário nem o que fazer com q fora da faixa. A UI precisa expor
alguma escala; qual é decisão de produto → P0.
