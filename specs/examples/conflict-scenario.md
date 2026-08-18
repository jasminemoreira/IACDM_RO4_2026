# Cenário de conflito — reproduzível

Satisfaz o critério 3 do Incremento 3: "o comportamento sob conflito é reproduzível a partir
de um cenário descrito". Os números abaixo foram **derivados**, não estimados.

## Roteiro

Instante base `T0 = 2026-09-01T09:00:00Z`. Duas réplicas, `A` e `B`.

1. **Estado comum, já sincronizado:** `A` revisa `c001` com `q=4` em `T0`, e `c002` com `q=5`
   em `T0+1min`. Ambas as réplicas conhecem esses dois eventos.
2. **As duas ficam offline.** Nenhuma vê a outra.
3. `A` revisa `c001` com **`q=5`** em `T0+2h` — acertou.
4. `B` revisa `c001` com **`q=2`** em `T0+2h30` — errou o **mesmo cartão**.
5. `B` revisa `c002` com `q=4` em `T0+2h40`.
6. `A` revisa `c002` com `q=3` em `T0+3h`.
7. **Ambas voltam à rede e sincronizam.**

## Log fundido — ordem total `(at, replicaId)`

| # | at | réplica | cartão | q |
|---|---|---|---|---|
| 1 | 2026-09-01T09:00:00Z | A | c001 | 4 |
| 2 | 2026-09-01T09:01:00Z | A | c002 | 5 |
| 3 | 2026-09-01T11:00:00Z | A | c001 | 5 |
| 4 | 2026-09-01T11:30:00Z | B | c001 | 2 |
| 5 | 2026-09-01T11:40:00Z | B | c002 | 4 |
| 6 | 2026-09-01T12:00:00Z | A | c002 | 3 |

## Resultado esperado

| | c001 | c002 |
|---|---|---|
| Só `A`, antes de sincronizar | `n=2, EF=2.6, I=6` | `n=2, EF=2.46, I=6` |
| Só `B`, antes de sincronizar | `n=0, EF=2.18, I=1` | `n=2, EF=2.6, I=6` |
| **RESOLVIDO** | **`n=0, EF=2.28, I=1`** | **`n=3, EF=2.46, I=16`** |

## As três propriedades que o cenário demonstra

| Propriedade | Verificação | Resultado |
|---|---|---|
| **Convergência** | `A` recebendo `B` produz o mesmo estado que `B` recebendo `A` | ✅ idêntico |
| **Idempotência** | Sincronizar duas vezes não muda nada | ✅ idêntico |
| **Nenhuma revisão perdida** | Eventos no log resolvido | ✅ **6 de 6** |

## Por que este cenário é a prova, e não uma ilustração

Olhe o `EF` resolvido de `c001`: **2.28**. Ele não é o de `A` (2.6) nem o de `B` (2.18) —
é o valor que resulta de **contar as duas revisões**: o `q=5` de `A` subiu o `EF` para 2.6, e
o `q=2` de `B`, trinta minutos depois, zerou `n` e derrubou o `EF` em 0,32.

Uma resolução por sobrescrita (LWW) devolveria `n=2, EF=2.6` ou `n=0, EF=2.18` — e em ambos
os casos **uma das duas revisões teria deixado de existir para o agendador**. O critério 2 do
I3 não pede que as revisões sobrevivam num histórico: pede que nenhum lado as perca. Aqui elas
não apenas sobrevivem, elas **contam**.

`c002` mostra o outro lado da mesma moeda: as duas réplicas acertaram, e o resultado (`n=3`)
é maior que o de qualquer uma isolada (`n=2`) — porque foram, de fato, três revisões.

## Como reencenar

Sem navegador, no núcleo puro (`node --test`): construir os dois logs locais, chamar
`merge` e `fold`, conferir contra a tabela acima. Determinístico, sem relógio real.

Com navegador e servidor, manualmente: dois perfis do Chrome contra o mesmo endpoint,
com a rede desligada no passo 2 e religada no passo 7.
