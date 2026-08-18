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
| C — processo exigível | `hanzi-pwa-w2/` | `braco-C` | — | — |

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

## 4. Discrição da operadora nos *gates* — braço C

§5: anotar **toda** vez que a operadora exercer discrição em G0, G2, G4 ou G6 — o quê e
por quê. Esses registros são o dado que dirá quanta discrição a batelada válida precisa
terceirizar.

| data | gate | o que a operadora decidiu | por quê |
|---|---|---|---|
| — | — | — | — |

## 5. Descartes e intervenções

Todo descarte e toda intervenção, nos dois braços, no ato.

| data | braço | o quê | motivo |
|---|---|---|---|
| 2026-08-18 | instrumento de medição | `extrair.py`: resolvedor de import passa a desfazer a troca ESM do TypeScript (`../deck/index.js` → `index.ts`) | com o bug, **nenhuma** aresta entre módulos resolvia e `E` ficava zerada nos dois braços — um terço da DV morto sem sinal. Detectado no aviso de imports não resolvidos, ao verificar o incremento 1 do braço A, antes de qualquer extração definitiva. Regressão contra o histórico sintético do §3c refeita e idêntica (`16` · `1,2308`). Nenhum dado havia sido extraído antes da correção |

## 6. Violações de protocolo

| data | braço | violação | consequência |
|---|---|---|---|
| — | — | — | — |
