# RO4 — Piloto de medibilidade (desenho do estudo)

Escrito em 2026-08-18.

> **Este arquivo não chega a nenhum agente.** Ele nomeia a hipótese, os braços, a
> predição e onde o efeito é esperado. Um agente que o leia é um agente informado do
> resultado desejado, o que contamina o **tratamento** e não apenas o artefato.
>
> Vive fora de `pilot_proj/` por isso, e porque `.versus/inject-context.js` injeta
> contexto do diretório do projeto. O que chega aos braços é
> **[`TAREFA-PILOTO.md`](TAREFA-PILOTO.md)**, copiado como `REQUISITOS.md` na raiz de
> cada braço, e que contém requisitos e nada mais.

---

## 1. O que este piloto é, e o que não é

**É** decisão *go/no-go* sobre **medibilidade** — se a variável dependente da H10 pode
ser computada num projeto deste porte.

**Não é** teste da H10. Nada daqui entra em análise, vira achado ou é citável. Se o
braço C sair melhor que o A, isso **não** é evidência de nada: n=1, tarefa escolhida
depois da hipótese, operadora é a autora do método.

Esta seção existe porque a tentação de ler o piloto como resultado é real, e o custo de
ceder a ela é perder o experimento inteiro.

## 2. As três perguntas, nesta ordem

1. **`t₀` é localizável por incremento?** Se o primeiro *commit* com código executável
   coincidir com o primeiro *commit* do repositório, não há "antes" e a métrica degenera.
2. **Existe churn arquitetural pós-`t₀`?** Zero nos dois braços mata a métrica.
3. **A extração é exequível?** O script deriva `M`, `E` e `I` de cada *commit* sem
   intervenção manual.

## 3. Braços

| braço | diretório | condição |
|---|---|---|
| **C — processo exigível** | `pilot_proj/` | IACDM completo, *gates* operados pelo instrumento |
| **A — direto** | `pilot_direct/` | sem Versus, sem `specs/`, sem fases; revisão só ao final |

O braço **B** (processo por instrução) **não entra no piloto**. Ele existe para separar
*ter processo* de *forçar processo*, e essa separação só importa depois que a métrica se
provou. Rodá-lo agora gasta execução sem responder nenhuma das três perguntas.

Mesmo modelo gerador nos dois braços, mesma versão do instrumento, ambos registrados
nominalmente antes de começar.

## 4. Como a tarefa entra

`TAREFA-PILOTO.md` é a entrada, **idêntica nos dois braços**. Não mora dentro de nenhum
deles justamente para poder ser simétrica: o braço A não tem `specs/`.

- Copiada como **`REQUISITOS.md` na raiz** de cada braço — não em `specs/`, que no braço
  C é artefato medido e vai ao depósito.
- **Primeiro *commit* de cada repositório**, antes de qualquer código. O histórico git
  passa a provar sob que especificação o braço rodou, em vez de exigir confiança.
- Nome neutro de propósito: `TAREFA-PILOTO` denunciaria a existência de um piloto.
- *Hash* registrado em `CONGELAMENTO.txt` antes de qualquer execução.
- O algoritmo de agendamento está **fixado em SM-2** de propósito. Deixá-lo "declarado
  mas livre" permitiria aos dois braços escolherem algoritmos diferentes, e estrutura de
  módulo diferente por consequência — confundidor evitável a custo zero.

## 5. Regras de execução

- Nenhuma alteração na tarefa após o início. Se ela se mostrar mal dimensionada, isso
  **é** o resultado do piloto.
- Registrar todo descarte e toda intervenção, no ato.
- Braço C: os *gates* decidem. **Anotar toda vez que a operadora exercer discrição em
  G0, G2, G4 ou G6** — o quê e por quê. Esses registros são o que dirá quanta discrição
  a batelada válida precisa terceirizar, que é a decisão de operador ainda aberta.

## 6. Medição

Estado arquitetural de um *commit* `c`:

- `M(c)` — diretórios de primeiro nível sob `src/`
- `E(c)` — arestas dirigidas de `import` cruzando fronteira de módulo
- `I(c)` — símbolos exportados por módulo

`t₀(k)` — primeiro *commit* do incremento `k` que acrescenta ou altera código executável
sob `src/`, excluindo JSON de conteúdo e configuração.

```
churn_pós = Σ_k Σ_{commits > t₀(k) em k} (|ΔM| + |ΔE| + |ΔI|)
            ──────────────────────────────────────────────────
                   |M_final| + |E_final| + |I_final|
```

Secundárias: posição de `t₀(k)` dentro de cada incremento; LOC final, como confundidor
— menos churn com menos código é escopo menor, não convergência.

**Onde o efeito é esperado:** o incremento 3. Resolução de conflito costuma forçar
mudança no modelo de persistência projetado no incremento 2, e é esse churn tardio que a
métrica precisa detectar. Se nem ali houver, a métrica não serve — que é uma conclusão
válida e o motivo de o piloto existir.

## 7. Critério de decisão

| resultado | leitura |
|---|---|
| churn pós-`t₀` > 0 em ao menos um braço, `t₀` localizável, extração automática | **GO** — protocolo segue com ciclos exógenos |
| churn ≈ 0 nos dois braços | **NO-GO de porte** — subir escopo ou abandonar a métrica |
| `t₀` ou fronteiras de módulo não computáveis | **NO-GO de extração** — redefinir a DV |
| incrementos não produzem `t₀` separável | **REDESENHO** — voltar a passe único, com granularidade de *commit* como exigência |

## 8. Contaminação

- Esta tarefa fica **queimada** para a batelada válida. É o preço normal de um piloto.
- Não ajustar a tarefa para o braço C ir melhor. Se a tentação aparecer, ela própria é
  dado sobre por que a batelada válida precisa de outro operador.
- O piloto **não** entra na análise — nem como projeto extra, nem como pré-teste, nem
  como ilustração.
