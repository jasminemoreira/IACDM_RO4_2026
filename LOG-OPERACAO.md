# RO4 piloto — log de operação

Registro nominal, decisões de montagem, discrição da operadora e descartes.
Regra do desenho (§5): **anotar no ato**, não depois.

---

## 1. Registro nominal — antes do início

Preenchido em 2026-08-18, antes de qualquer execução em qualquer braço.

| item | valor |
|---|---|
| modelo gerador, braço A | `claude-opus-5` |
| modelo gerador, braço C | `claude-opus-5` |
| instrumento, braço C | extensão `versus-claude` **0.16.3** |
| instrumento, braço A | nenhum |
| ordem de execução | **A antes de C** |
| tarefa | `TAREFA-PILOTO.md`, sha256 `e7dbfd80d7431f847c965d3aae2053bcf3ba2e2d95d2304707196892608144f0` |
| extrator | `extrair.py`, escrito e validado antes de qualquer execução |
| git (instrumento de medição) | 2.34.1 |
| python (extração) | 3.12.1 |

Motivo da ordem: a operadora é a autora do método. Rodar o braço direto **primeiro**
evita operá-lo depois de já ter visto o braço C construir a mesma tarefa — o único
viés de ordem que a operadora pode remover sem custo.

## 2. Datas

| braço | diretório | branch remoto | início | fim |
|---|---|---|---|---|
| A — direto | `hanzi-pwa-w1/` | `braco-A` | 2026-08-18 | — |
| C — processo exigível (1ª execução, **descartada**) | `_descartado/hanzi-pwa-w2/` | `braco-C-descartado` | 2026-08-18 | 2026-08-18 |
| C — processo exigível (2ª execução) | `hanzi-pwa-w2/` | `braco-C` | 2026-08-18 | — |

Fronteiras de incremento do braço A, marcadas pela coordenação no commit em que a
operadora declarou o aceite:

| inc | tag | commit | data | commits | `t₀` |
|---|---|---|---|---|---|
| 1 | `inc1-fim` | `9cf6095` | 2026-08-18 | 11 | `5952cdc`, posição 4/11 |
| 2 | `inc2-fim` | `779fcb3` | 2026-08-18 | 5 | `be2c0ef`, posição 1/5 |
| 3 | `inc3-fim` | `e6fe2dc` | 2026-08-18 | 6 | `be4ddfc`, posição 1/6 |

Braço C:

| inc | tag | commit | data | commits | `t₀` |
|---|---|---|---|---|---|
| 1 | `inc1-fim` | `206604d` | 2026-08-18 | 16 | `321fa56`, posição **15/16** |

Braço C, 2ª execução:

| inc | tag | commit | data | commits | `t₀` |
|---|---|---|---|---|---|
| 1 | `inc1-fim` | `6b3ba02` | 2026-08-18 | 11 | `2cf4a7e`, posição 5/11 |
| 2 | `inc2-fim` | `ba2ec08` | 2026-08-18 | 5 | `f8ac775`, posição 2/5 |

## 3. Decisões de montagem — coordenação, antes do início

| data | decisão | motivo |
|---|---|---|
| 2026-08-18 | `git init` em cada braço, `REQUISITOS.md` como **primeiro commit** | §4: o histórico prova sob que especificação o braço rodou |
| 2026-08-18 | `.gitignore` simétrico como segundo commit, antes de qualquer código (`node_modules/`, `dist/`, `.versus/state.json`) | tirar da história o que não é artefato medido, sem assimetria entre braços |
| 2026-08-18 | **um repositório por braço**, não um repositório único com os dois em subpastas | num repo único a sessão de cada braço alcança a história e o código do outro, e o `PILOTO.md` no mesmo *work tree* |
| 2026-08-18 | branch local de cada braço chamado `main`; o nome do braço existe **só no remoto**, via *refspec* `main:braco-A` / `main:braco-C` | mesma razão de `TAREFA-PILOTO.md` virar `REQUISITOS.md`: um branch `braco-A` denunciaria o experimento à sessão que o opera |
| 2026-08-18 | execução **em paralelo considerada e recusada**; mantida a ordem serial A→C do §1 | no paralelo a operadora veria o modelo de persistência do braço C, desenhado na Fase 2, antes de o braço A chegar ao incremento 3; o aceite do incremento 2 de A absorveria isso e o churn tardio sumiria dos dois braços — que o §7 manda ler como NO-GO de porte. Métrica boa descartada por dica da operadora, e no braço sem gate nada registraria a dica |
| 2026-08-18 | repositório de coordenação na raiz do `RO4/`, com os dois braços em `.gitignore` | `PILOTO.md` versionado sem entrar em nenhum *work tree* de braço |

### Renomeação dos diretórios dos braços — 2026-08-18, antes de qualquer execução

`pilot_proj/` → `hanzi-pwa-w2/` (braço C) · `pilot_direct/` → `hanzi-pwa-w1/` (braço A).

Os nomes antigos diziam à sessão que operava o braço que ela era braço de um piloto, e
`_proj` vs `_direct` dizia **qual condição era qual** — mesma classe de vazamento que o
§4 do `PILOTO.md` evitou ao renomear a tarefa para `REQUISITOS.md`, e pior, porque
identificava o tratamento. Os nomes novos são simétricos e não carregam condição: entre
os dezoito diretórios de `INDT/`, leem-se como projeto comum.

Feito antes de existir qualquer código, com o hash de `TAREFA-PILOTO.md` inalterado e os
dois braços ainda no mesmo SHA (`b909b82`). `PILOTO.md` §3 e `CONGELAMENTO.txt` atualizados,
cada um com a nota do porquê.

### Contaminação residual conhecida, não corrigida

O diretório-pai continua sendo `RO4/`, e um `ls ..` a partir de um braço ainda alcança
`PILOTO.md`, `CONGELAMENTO.txt` e este log — que é o vazamento mais grave dos dois, porque
não expõe só a existência do piloto, e sim a hipótese, o braço esperado e onde o efeito é
esperado. Nenhuma renomeação resolve: só mover os braços para fora da árvore do `RO4/`, ou
mover o material de coordenação para um diretório que não seja irmão dos braços.

**Decidido em 2026-08-18, antes do início do braço A: aceitar e registrar.** Os braços
ficam onde estão. Fundamento: é piloto de medibilidade, nada daqui entra em análise (§1 e
§8 do `PILOTO.md`), e o vazamento exige que a sessão suba de diretório por conta própria —
não é apresentado a ela. **Limitação conhecida deste piloto, a corrigir na batelada
válida**, onde o dado é citável e o custo de uma sessão curiosa deixa de ser zero.

Se durante a execução houver indício de que uma sessão leu material acima do seu
diretório, registrar no §5 e tratar o braço como descartado — não como recuperável.

## 3b. Fronteira de incremento — convenção de medição

O §6 do `PILOTO.md` define `t₀(k)` *dentro* do incremento `k`, mas não diz como recuperar
`k` do histórico. Sem convenção, os incrementos não são separáveis e o piloto cairia em
REDESENHO por falha de instrumentação, não por achado.

**Convenção, idêntica nos dois braços:** ao aceitar o incremento `k`, a operadora marca

```
git tag -a inc<k>-fim -m "incremento <k> aceito"
```

no commit aceito. Incremento `k` = commits em `(inc<k-1>-fim, inc<k>-fim]`.

É ato de operadora, não instrução ao braço: não toca no `REQUISITOS.md` congelado, não
altera o tratamento e não pede ao modelo nada que o §6 da tarefa já não peça. Sem as tags
o `extrair.py` **falha alto** — não estima fronteira nem cai para melhor esforço.

## 3c. Validação do extrator — antes de qualquer execução

Testado contra histórico sintético de 10 commits e 3 incrementos, com churn calculado à
mão: esperado `3 · 3 · 10 = 16`, `|M|=4 |E|=3 |I|=6`, normalizado `1,2308` — medido idêntico.
Cobre os três modos de falha que importam: commit não-código não vira `t₀`, renomeação de
export conta `ΔI=2`, renomeação de módulo conta `10`. `|ΔX|` é diferença simétrica, não
variação líquida — no mesmo histórico a leitura líquida daria `4` e faria um piloto com
churn real parecer NO-GO por artefato do script.

## 3d. Churn retroativo — medida secundária, acrescentada em 2026-08-18

**A DV primária do §1 não muda.** O `extrair.py` passa a reportar, ao lado dela:

```
retro(c) = |(P △ C) ∩ B|,   B = estado no aceite do incremento anterior
```

Motivo: a fórmula do §6 conta todo commit posterior a `t₀(k)`, e depois de `t₀(k)` está o
grosso da **construção** do incremento — no incremento 1 do braço A, 50 dos 51 pontos de
churn são módulo novo com exports novos, e só 1 é retrabalho. Assim medido, um braço que
constrói mais módulos pontua mais churn, que é o confundidor de escopo que o §6 tenta
controlar por fora, com LOC.

O §6 em prosa quer outra coisa: *"resolução de conflito costuma forçar mudança no modelo de
persistência projetado no incremento 2"* — o incremento `k` desfazendo o que `k-1` construiu.
O retroativo isola isso: só conta elemento que já existia quando o incremento começou. No
incremento 1 dá 0 por definição.

Validado no mesmo histórico sintético do §3c, com valores calculados à mão: primária
`16` inalterada, retroativo `0 · 0 · 4`. Renomear export criado no próprio incremento dá
`retro=0`; renomear o módulo que o incremento anterior construiu dá `retro=4`.

`retro_em_t0` sai à parte: é o mesmo cálculo no próprio commit `t₀(k)`, que a primária
exclui por definição, para não esconder o caso em que o commit que abre o incremento já
mexe no que veio antes.

**Momento da decisão:** braço A no meio do incremento 2, braço C não iniciado, nenhuma
comparação entre braços existente. A medida não pôde ser ajustada a um resultado porque
não havia resultado.

## 3e. Achado do braço A — a DV não vê o retrabalho que ela existe para medir

Registrado em 2026-08-18, com o braço A concluído e o **braço C não iniciado**.

O evento que o §6 do `PILOTO.md` prevê aconteceu, e de forma inequívoca: o commit
`be4ddfc` do incremento 3 (*"progresso derivado de um log de revisões, com migração do
modelo 1 para o 2"*) reescreveu o modelo de persistência criado no incremento 2 — 176
linhas apagadas em `storage/modelo.ts`, `migracao.ts` e `repositorio.ts`.

A DV registrada quase não o vê. Dois defeitos independentes, ambos estruturais:

**1. Janela.** `t₀(3)` **é** o commit `be4ddfc`. A primária conta commits `> t₀(k)`, então o
único commit de retrabalho arquitetural do braço inteiro está fora da janela por definição.
Não é acidente deste projeto: retrabalho tende a vir *primeiro* no incremento — refatora-se
para abrir espaço, depois constrói-se — e é exatamente esse commit que a fórmula exclui.
`t₀` caiu na posição 1 em dois dos três incrementos.

**2. Sensibilidade.** `M`, `E` e `I` medem a *superfície* do módulo. A reescrita preservou a
superfície: dos 176 apagados, o efeito em `I` foi **um** símbolo removido
(`storage.gravarProgresso`). Uma troca de modelo interno que mantém a interface é invisível
à DV.

Consequência para o §7: a leitura literal da tabela dá **GO** — churn pós-`t₀` = 108 > 0,
`t₀` localizável, extração automática. Seria GO pelo motivo errado: os 108 são construção
(módulo novo, exports novos), e o retrabalho real vale 0 na primária e 1 na secundária.
A tabela do §7 não tem linha para "DV computável, porém insensível ao construto".

### Candidata registrada antes do braço C: churn retroativo de linha

Linhas removidas/alteradas em arquivos sob `src/` que **já existiam** no aceite do
incremento anterior, excluindo teste e arquivo criado no próprio incremento:

| inc | interface (`retro`) | linha |
|---|---|---|
| 1 | 0 | 0 |
| 2 | 0 | 54 |
| 3 | 0 (+1 em `t₀`) | **100**, dos quais 85 em `storage/` |

Registrada aqui, com definição fechada, **antes de o braço C rodar** — mesma disciplina do
§3d. Foi vista sobre o braço A, o que é limitação real e fica escrita: nenhuma comparação
entre braços existia no momento do registro, mas o braço A existia.

## 4. Discrição da operadora nos *gates* — braço C

§5: anotar **toda** vez que a operadora exercer discrição em G0, G2, G4 ou G6 — o quê e
por quê. Esses registros são o dado que dirá quanta discrição a batelada válida precisa
terceirizar.

| data | gate | o que a operadora decidiu | por quê |
|---|---|---|---|
| 2026-08-18 | G0 | alvo de entrega = **produto completo, 3 incrementos** (contra "MVP primeiro, depois iterar" e "protótipo") | é a leitura literal do `REQUISITOS.md` §6 — *"cada incremento é entregue e aceito antes do seguinte começar"* — e é a única opção que mantém os braços comparáveis: o braço A entregou os três. MVP teria reduzido o braço C a um terço do escopo do A, e a diferença de churn viraria diferença de tamanho |
| 2026-08-18 | G0 | lapso `q<3` = **literal, sai da sessão e volta em 1 dia** (contra SM-2 clássico com fila intra-sessão) | o pseudocódigo do `REQUISITOS.md` §4 escreve `n=0; I=1` e nada sobre reapresentar na mesma sessão; a §4 proíbe variante. Terceirizável |
| 2026-08-18 | G0 | migração de deck = **`id` é a identidade, preserva tudo** (progresso de cartão removido fica retido e ressuscita; conteúdo editado com mesmo `id` mantém progresso) | é a leitura mais forte de *"migra o progresso sem perda"* (I2). As outras duas descartam revisões em algum caso, e "sem perda" passaria a valer só para os sobreviventes. Terceirizável |
| 2026-08-18 | G0 | pesquisa web permitida, com depósito em `specs/` e citação de fonte | decisão de processo, não de produto; não altera o artefato medido. Terceirizável por protocolo |
| 2026-08-18 | G0 | remoto do incremento 3 = **endpoint JSON simples, servidor real** (contra duplo local no navegador) | **a única das quatro que a especificação congelada NÃO responde**: o §6 do `REQUISITOS.md` diz explicitamente *"pode ser um endpoint JSON simples ou um duplo local"*. Discrição genuína. **Ver a marca de contaminação abaixo** |

### Contaminação: a escolha do remoto coincide com o braço A

O braço A implementou servidor HTTP real (`servidor/remoto.mjs`, commit `f14eb6b`). A operadora
operou o braço A inteiro antes de responder este `gate`, e escolheu para o braço C a mesma
opção — contra a alternativa que o próprio instrumento descreve como mais reproduzível.

Não é acusação de má-fé, e não há como distinguir convergência de vazamento com n=1. É o custo
previsto da ordem serial A→C com operadora única, discutido em 2026-08-18 quando o paralelo foi
recusado, e agora materializado num ponto identificável.

**Direção do viés:** alinhar as escolhas de desenho do braço C às do braço A **reduz** a
divergência entre os braços e torna a comparação de churn mais conservadora — menos provável
de mostrar diferença, não mais. Para um piloto de medibilidade é tolerável; para a batelada
válida, não é, e a correção é operador que não construiu o braço anterior.

**Para a batelada válida:** este ponto exige regra no protocolo, não escolha no ato — por
exemplo, fixar o remoto na especificação congelada, como o §4 do `PILOTO.md` já fez com o SM-2
pelo mesmo motivo ("deixá-lo declarado mas livre permitiria aos dois braços escolherem
algoritmos diferentes, e estrutura de módulo diferente por consequência — confundidor evitável
a custo zero"). O remoto é o mesmo caso, e passou despercebido no congelamento.

**Observação de método, não de projeto:** o instrumento *perguntou* o alvo de entrega mesmo
com o `REQUISITOS.md` congelado respondendo à pergunta no §6. A operadora não escolheu escopo,
transcreveu a especificação. É caso de discrição **terceirizável**: a batelada válida pode
responder isto por regra ("alvo = o que a especificação congelada disser"), sem operador
humano no laço. Primeiro item concreto da lista que o §5 do `PILOTO.md` manda levantar.

**Dado sobre a própria pergunta do §5:** a coordenação propôs em 2026-08-18 terceirizar a discrição para um conjunto de regras derivadas da especificação congelada; a operadora manteve a discrição consigo. Para a decisão de operador ainda aberta, isto é observação, não falha: mede-se o que o operador humano de fato faz quando a alternativa existe e está posta.

Placar de G0, cinco decisões: **quatro terceirizáveis** por regra derivada da especificação
congelada (alvo de entrega, lapso `q<3`, migração de deck, política de pesquisa) e **uma
genuína** (o remoto), que a especificação delega de propósito. A batelada válida pode tirar o
humano de quatro dos cinco pontos — e deveria fechar o quinto no congelamento.

## 4b. Granularidade de commit — assimetria entre os braços

O §7 do `REQUISITOS.md` (congelado, idêntico nos dois braços) exige *"comitar a cada passo com
significado próprio; não agrupar um incremento inteiro num único commit"*.

| | braço A, inc 1 | braço C, inc 1 |
|---|---|---|
| commits no incremento | 11 | 16 |
| commits **com código** | 8 | **2** (861 e 976 linhas) |
| `t₀` | 4/11 | **15/16** |
| janela pós-`t₀` | 7 commits | **1 commit** |

O braço C cumpre a exigência para os artefatos de fase (12 commits de `specs/`) e não a cumpre
para o código. Consequência sobre a medição, não sobre o produto: a DV primária é computada
**por commit**, e uma janela de um único commit não tem como exibir churn — o incremento inteiro
chega como estado final. Não é ausência de retrabalho: é ausência de granularidade para observá-lo.

Isto torna os braços não comparáveis na primária por um motivo que nada tem a ver com método:
a mesma quantidade de retrabalho produz números diferentes conforme o tamanho do commit.
Corresponde à linha REDESENHO do §7 do `PILOTO.md` — *"granularidade de commit como exigência"* —
e a exigência já está na especificação congelada; o que falta é ela ser operada.

### Granularidade na 2ª execução do braço C

A assimetria que motivou parte do descarte não se repetiu. Incremento 1:

| | braço A | braço C, 1ª exec. (descartada) | braço C, 2ª exec. |
|---|---|---|---|
| commits no incremento | 11 | 16 | 11 |
| commits com código | 8 | **2** | 6 |
| `t₀` | 4/11 | **15/16** | 5/11 |
| janela pós-`t₀` | 7 | **1** | 5 |
| LOC | 1117 | 1221 | 1101 |

A janela pós-`t₀` do braço C voltou a ter granularidade suficiente para a primária observar
churn, e os dois braços ficaram com contagem de commits e LOC próximos — o confundidor de
escopo que o §6 monitora está pequeno neste incremento.

### Confundidor de escopo no incremento 2 — registrar antes de qualquer leitura

| ao fim do incremento 2 | braço A | braço C |
|---|---|---|
| LOC | 2537 | **1334** |
| `\|M\|` `\|E\|` `\|I\|` | 7 · 13 · 85 | 7 · 15 · 65 |
| churn pós-`t₀` no inc. 2 | 45 | **4** |
| retro de linha no inc. 2 | 54 | **7** |

O §6 do `PILOTO.md` avisa exatamente para este caso: *"LOC final, como confundidor — menos
churn com menos código é escopo menor, não convergência"*. O braço A tem **1,9×** o código do
braço C ao fim do mesmo incremento. Qualquer leitura das duas colunas de churn sem essa
terceira é leitura de escopo disfarçada de leitura de método.

**Fato de arquitetura a registrar, sem interpretação:** o módulo `progress/` do braço C contém,
desde o **incremento 1** (`5985f01`), a álgebra do log de revisões — união de G-Set, ordem
canônica e *replay*. No braço A, o equivalente aparece só no **incremento 3** (`be4ddfc`), e
aparece como reescrita do modelo de persistência do incremento 2. Registrado agora, antes de
o incremento 3 do braço C existir, para que a observação não seja construída depois do fato.

**O §1 do `PILOTO.md` continua valendo:** nada disto é evidência sobre a H10. n=1, tarefa
escolhida depois da hipótese, operadora autora do método, e o braço C ainda por cima está na
2ª execução com o braço A já conhecido.

### A medida de interface ainda não disparou em lugar nenhum

`retro-interface` = 0 nos três incrementos do braço A e nos dois do braço C até aqui, incluindo
o commit do braço A que reescreveu 176 linhas do modelo de persistência. A medida de linha
disparou nos dois braços. Isto é achado de medibilidade por si: a granularidade de `M`/`E`/`I`
pode ser grosseira demais para o porte deste projeto, independentemente do braço.

## 5. Descartes e intervenções

Todo descarte e toda intervenção, nos dois braços, no ato.

| data | braço | o quê | motivo |
|---|---|---|---|
| 2026-08-18 | C | **execução do braço C descartada integralmente**; braço preservado em `_descartado/hanzi-pwa-w2/` com `MOTIVO.md`, ramo remoto renomeado para `braco-C-descartado`. Braço A não afetado | dois motivos independentes, cada um suficiente: (a) exposição ao braço A e ao `PILOTO.md` pelo `git fetch` das 18:25, com leitura indetectável e irrefutável; (b) granularidade de commit incompatível com a DV — 2 commits de código contra 8 no braço A, janela pós-`t₀` de um commit só |
| 2026-08-18 | C | braço C recriado do zero: **mesmos dois commits iniciais do braço A, SHA a SHA** (`b7592fe`, `b909b82`), `versus-claude` 0.16.3, e **nenhum remoto configurado dentro do braço** | o vazamento entrou por um remoto que, do lado de dentro, dava acesso a todos os ramos. Sem remoto no workspace, `git fetch` não tem o que trazer. A coordenação empurra de fora, por URL explícita, sem gravar config no repositório do braço. Datas de autor fixadas para reproduzir os SHAs originais — o estado inicial idêntico volta a ser verificável, não afirmado |
| 2026-08-18 18:25 | C | **`git fetch` dentro do braço C trouxe `origin/braco-A`, `origin/coordenacao` e as três tags do braço A para dentro do repositório** | exposição do braço C ao histórico completo do braço A e ao `PILOTO.md` — hipótese, braço esperado, local do efeito — por `git show origin/coordenacao:PILOTO.md`. **Cronologia:** último commit do incremento 1 às 18:21:11, fetch às 18:25:58; o incremento 1 foi construído antes de a exposição existir. **Contenção imediata:** tags removidas, refs `braco-A` e `coordenacao` apagadas, `git gc --prune=now` (os objetos já não existem no braço C), e `remote.origin.fetch` restrito a `braco-C`. Evidência preservada fora do braço (`FETCH_HEAD` e reflog). **Detectável: o acesso. Não detectável: a leitura.** Autoria do fetch — sessão ou operadora — em apuração |
| 2026-08-18 | coordenação | a coordenação comentou o **mérito** das opções de G0 antes da submissão (escopo da pesquisa, escolha do remoto) e propôs substituir a discrição por um conjunto de regras derivadas da especificação | **intervenção no tratamento, registrada como tal.** Partiu de quem leu o `PILOTO.md` e conhece a hipótese, o braço esperado e o local do efeito — a pior origem possível. A operadora determinou que a coordenação não interrompa e que a operação siga a critério dela, o que é a leitura correta do §5: os *gates* decidem e a discrição é dado a registrar, não variável a corrigir. A partir daqui a coordenação **registra e mede, não opina sobre mérito**. O que já foi dito não se desfaz e fica no registro para quem ler o dado |
| 2026-08-18 | C | `init_project` chamado à mão pela operadora **antes** do `start`, com `projectName` "Chinese Xpress" e descrição "App de aprendizado de chinês" | desvio do roteiro, **sem efeito sobre o dado**: o estado ficou em Fase 0, iteração 1, com `decisions`, `activatedLenses`, `exitCriteria` e `projectSpec` vazios — exatamente onde o `start` pararia. O hook de `SessionStart` prevê o caminho (*greenfield: ask the user for a project name and description, then call init_project directly*), então a operadora fez à mão o que a sessão faria ao perguntar. Nome e descrição são entrada da operadora nos dois caminhos. Efeitos colaterais comitados em `94f3cef`+1 antes de qualquer código: hooks `PreCompact`/`SessionStart` no `settings.json` e `specs/README.md` |
| 2026-08-18 | C | `versus-claude` 0.16.3 instalado por `preparar-braco-c.py`, commit `94f3cef`, antes de qualquer código | provenance do instrumento no próprio histórico do braço, como o `REQUISITOS.md` é para a especificação. `.versus/state.json` fica fora do commit (muda a cada chamada de ferramenta) e será arquivado no repositório de coordenação ao fim do braço |
| 2026-08-18 | instrumento de medição | `extrair.py` ganha o **churn retroativo de linha** como secundária, definição do §3e | reproduz `0 · 54 · 100` do braço A e não altera a primária; renomeação de arquivo não conta aqui (o git a detecta como rename), quem a pega é a medida de interface — as duas são complementares |
| 2026-08-18 | A | tag `inc1-fim` criada pela coordenação em `9cf6095`, depois de o incremento 2 já ter começado | o aceite do incremento 1 é ato da operadora e já estava registrado no próprio commit (*"aceitação do Incremento 1"*); a tag só o torna legível para o extrator. Tag em git é retroativa e o extrator usa posição no histórico, não data da tag — nenhum dado afetado |
| 2026-08-18 | instrumento de medição | `extrair.py`: resolvedor de import passa a desfazer a troca ESM do TypeScript (`../deck/index.js` → `index.ts`) | com o bug, **nenhuma** aresta entre módulos resolvia e `E` ficava zerada nos dois braços — um terço da DV morto sem sinal. Detectado no aviso de imports não resolvidos, ao verificar o incremento 1 do braço A, antes de qualquer extração definitiva. Regressão contra o histórico sintético do §3c refeita e idêntica (`16` · `1,2308`). Nenhum dado havia sido extraído antes da correção |

## 6. Violações de protocolo

| data | braço | violação | consequência |
|---|---|---|---|
| — | — | — | — |
