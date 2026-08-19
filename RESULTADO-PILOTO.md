# RO4 — resultado do piloto de medibilidade

Escrito em 2026-08-18, com os dois braços concluídos.

> **Este documento decide medibilidade, não hipótese.** Nada aqui é evidência sobre a H10, e
> as duas colunas de braço existem para responder *"a DV é computável e sensível?"*, não
> *"qual braço é melhor?"*. O §1 do [`PILOTO.md`](PILOTO.md) permanece: n=1, tarefa escolhida
> depois da hipótese, operadora autora do método, e o braço C ainda por cima rodou em 2ª
> execução com o braço A já conhecido. Qualquer leitura comparativa daqui é uso indevido.

---

## 1. Veredito

**GO com redefinição da DV.** As três perguntas do §2 foram respondidas, e o piloto encontrou
o que existia para encontrar: a DV registrada é **computável** e **insensível ao construto**.

| pergunta do §2 | resposta |
|---|---|
| 1 — `t₀` é localizável por incremento? | **sim**, nos 6 incrementos; nunca coincidiu com o primeiro *commit* do repositório |
| 2 — existe churn arquitetural pós-`t₀`? | **sim numericamente** (108 e 72), **não como construto**: o churn medido é construção, e o único retrabalho arquitetural real do estudo pontuou 0 na primária |
| 3 — a extração é exequível? | **sim**, automática, sem intervenção manual |

A tabela do §7 do `PILOTO.md`, lida ao pé da letra, dá GO — churn > 0 nos dois braços, `t₀`
localizável, extração automática. **Seria GO pelo motivo errado.** Falta à tabela a linha que
este piloto produziu: *DV computável, porém insensível ao construto*.

## 2. O que foi executado

| | braço A — direto | braço C — processo exigível |
|---|---|---|
| diretório | `hanzi-pwa-w1/` | `hanzi-pwa-w2/` |
| ramo | `braco-A` | `braco-C` |
| modelo gerador | `claude-opus-5` | `claude-opus-5` |
| instrumento | nenhum | `versus-claude` 0.16.3 |
| execuções | 1 | 2 — a 1ª descartada, ver [`_descartado/MOTIVO.md`](_descartado/MOTIVO.md) |

Tarefa idêntica, `sha256 e7dbfd80…8144f0`, primeiro *commit* de cada braço. Os dois partiram
do mesmo SHA (`b7592fe`, `b909b82`) — estado inicial verificável, não afirmado.

## 3. Os três defeitos da DV

### 3.1 Janela — o retrabalho cai *dentro* de `t₀`, que a fórmula exclui

O §6 conta *commits* `> t₀(k)`. Em **3 dos 6 incrementos** `t₀` foi o primeiro *commit* do
incremento, e a janela passou a cobrir o incremento inteiro menos o próprio `t₀`.

O caso decisivo é o incremento 3 do braço A. O evento que o §6 prevê — *"resolução de conflito
força mudança no modelo de persistência projetado no incremento 2"* — aconteceu em `be4ddfc`,
com 176 linhas apagadas em `storage/modelo.ts`, `migracao.ts` e `repositorio.ts`. **Esse
*commit* É o `t₀(3)`.** O único retrabalho arquitetural do estudo inteiro está fora da janela
por definição.

Não é acidente deste projeto: refatora-se para abrir espaço e depois se constrói, então o
retrabalho tende a ser o primeiro *commit* do incremento — exatamente o que a fórmula descarta.

### 3.2 Sensibilidade — `M`, `E`, `I` medem superfície, não modelo

`retro-interface` marcou **0 em todos os 6 incrementos**, nos dois braços, incluindo o
`be4ddfc`. A reescrita de 176 linhas removeu **um** símbolo exportado (`storage.gravarProgresso`).
Troca de modelo interno com interface preservada é invisível à DV.

A medida de linha, acrescentada durante o piloto, marcou 154 no braço A — 100 deles no
incremento 3, 85 concentrados em `storage/`. A distinção que a DV não faz, ela faz.

### 3.3 Granularidade — a DV mede o tamanho do *commit* junto com o retrabalho

A primária é computada por *commit*. A 1ª execução do braço C entregou o incremento 1 em **2
*commits* de código**, o que reduziu a janela pós-`t₀` a **um** *commit*: a mesma quantidade de
retrabalho produziria número diferente. O §7 do `REQUISITOS.md` já exige granularidade, mas a
exigência não foi verificada por ninguém durante a execução.

## 4. Números

| | A inc 1 | A inc 2 | A inc 3 | C inc 1 | C inc 2 | C inc 3 |
|---|---|---|---|---|---|---|
| *commits* | 11 | 5 | 6 | 11 | 5 | 2 |
| `t₀` | 4/11 | 1/5 | 1/6 | 5/11 | 2/5 | 1/2 |
| churn pós-`t₀` | 51 | 45 | 12 | 67 | 4 | 1 |
| retro-interface | 0 | 0 | 0 (+1 em `t₀`) | 0 | 0 | 0 |
| retro-linha | 0 | 54 | 100 | 0 | 7 | 0 |

| final | braço A | braço C |
|---|---|---|
| `\|M\|` `\|E\|` `\|I\|` | 8 · 18 · 110 | 8 · 18 · 71 |
| LOC | **3737** | **1497** |
| churn pós-`t₀` (normalizado) | 108 (0,79) | 72 (0,74) |
| retro-linha | 154 | 7 |

**A linha de LOC domina a tabela.** O braço A tem 2,5× o código do braço C, e o §6 já avisava:
*"menos churn com menos código é escopo menor, não convergência"*. Some-se a isso que o remoto
do incremento 3 — parâmetro que a especificação delega de propósito — saiu **servidor HTTP real**
no braço A e **duplo local** no braço C, com módulo a mais de um lado. Nenhuma comparação de
churn entre as colunas sobrevive a esses dois fatos.

## 5. O que a batelada válida precisa mudar

1. **Redefinir a janela.** Contar a partir de `t₀(k)` **inclusive**, ou ancorar a janela no
   início do incremento em vez de no primeiro *commit* com código. Como está, a fórmula é cega
   ao *commit* onde o retrabalho mais provavelmente vive.
2. **Trocar ou complementar a unidade estrutural.** `M`/`E`/`I` não resolvem retrabalho interno
   a módulo. O churn retroativo de linha resolveu, é computável do git puro e já está
   implementado em [`extrair.py`](extrair.py).
3. **Verificar granularidade durante a execução**, não depois. A exigência existe no
   `REQUISITOS.md` e foi violada sem que nada a barrasse.
4. **Fechar no congelamento os parâmetros que a especificação delega.** O remoto do incremento 3
   é confundidor da mesma classe que o SM-2, que o §4 fixou de propósito; o remoto passou.
5. **Isolar os braços por construção, não por disciplina.** Ver §6.
6. **Terceirizar a discrição de G0.** Das 5 decisões de *gate* registradas, 4 eram deriváveis
   por regra da especificação congelada; só o remoto era genuína — e essa deveria estar fixada.

## 6. Contaminações registradas

| | o quê | estado |
|---|---|---|
| diretório-pai | `ls ..` de um braço alcança `PILOTO.md` | aceito para o piloto, a corrigir na batelada |
| `git fetch` | trouxe o braço A e o `PILOTO.md` para dentro do braço C | **causou o descarte da 1ª execução do braço C**; fechado por construção — o braço não tem remoto configurado |
| ordem serial A→C | operadora viu o braço A antes de operar o C | inerente ao desenho com operadora única; corrige-se com outro operador |
| coordenação | comentou o mérito de opções de G0 antes da submissão | registrado no §5 do log; papel redefinido para registro e medição |

Todas em [`LOG-OPERACAO.md`](LOG-OPERACAO.md), com data e motivo.

## 7. O que este piloto não entrega

Nenhum dado sobre a H10. A tarefa está queimada para a batelada válida (§8). O braço B —
processo por instrução — continua fora, e continua sendo o que separa *ter processo* de
*forçar processo*.
