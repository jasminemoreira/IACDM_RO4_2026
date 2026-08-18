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

Motivo da ordem: a operadora é a autora do método. Rodar o braço direto **primeiro**
evita operá-lo depois de já ter visto o braço C construir a mesma tarefa — o único
viés de ordem que a operadora pode remover sem custo.

## 2. Datas

| braço | diretório | branch remoto | início | fim |
|---|---|---|---|---|
| A — direto | `hanzi-pwa-w1/` | `braco-A` | — | — |
| C — processo exigível | `hanzi-pwa-w2/` | `braco-C` | — | — |

## 3. Decisões de montagem — coordenação, antes do início

| data | decisão | motivo |
|---|---|---|
| 2026-08-18 | `git init` em cada braço, `REQUISITOS.md` como **primeiro commit** | §4: o histórico prova sob que especificação o braço rodou |
| 2026-08-18 | `.gitignore` simétrico como segundo commit, antes de qualquer código (`node_modules/`, `dist/`, `.versus/state.json`) | tirar da história o que não é artefato medido, sem assimetria entre braços |
| 2026-08-18 | **um repositório por braço**, não um repositório único com os dois em subpastas | num repo único a sessão de cada braço alcança a história e o código do outro, e o `PILOTO.md` no mesmo *work tree* |
| 2026-08-18 | branch local de cada braço chamado `main`; o nome do braço existe **só no remoto**, via *refspec* `main:braco-A` / `main:braco-C` | mesma razão de `TAREFA-PILOTO.md` virar `REQUISITOS.md`: um branch `braco-A` denunciaria o experimento à sessão que o opera |
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
**Decisão pendente da operadora antes do início do braço A.**

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
| — | — | — | — |

## 6. Violações de protocolo

| data | braço | violação | consequência |
|---|---|---|---|
| — | — | — | — |
