# Hanzi — PWA de revisão espaçada

Implementação do brief em [REQUISITOS.md](REQUISITOS.md). Os requisitos estão congelados;
este documento descreve o que já foi construído.

**Estado: Incremento 1 entregue.** Incrementos 2 e 3 ainda não começaram.

## Como rodar

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm test         # suíte de testes (49 testes)
npm run build    # checagem de tipos + build de produção
```

## Estrutura

Módulos são diretórios de primeiro nível sob `src/`, cada um com `index.ts` como único
ponto de entrada. Nenhum módulo importa arquivos internos de outro.

| Módulo | Responsabilidade | Depende de |
| --- | --- | --- |
| `src/deck/` | formato do conteúdo (§5) e validação da entrada | — |
| `src/scheduler/` | SM-2 (§4) e seleção de cartões devidos | — |
| `src/session/` | laço de revisão e progresso em memória | `deck`, `scheduler` |
| `src/ui/` | visão e desenho em DOM | `deck`, `scheduler` (só tipos) |
| `src/app/` | composição, estado da aplicação e bootstrap | todos |

O deck de entrada fica em [decks/exemplo.json](decks/exemplo.json), no formato da §5.
A aplicação apenas o lê: não cria nem edita conteúdo.

O fluxo é unidirecional. `src/app/estado.ts` guarda o estado, deriva uma `Visao` e a
entrega a `renderizar`; a `ui` não conhece o domínio nem toca no agendador.

## Decisões de implementação

O pseudocódigo da §4 admite duas leituras, fixadas assim — ambas cobertas por teste:

1. **O novo intervalo usa o `EF` anterior.** A linha `I = round(I_anterior * EF)` precede a
   atualização de `EF` no pseudocódigo, então é o `EF` de antes que entra no cálculo.
2. **`EF` é atualizado nos dois ramos**, acerto e erro, porque a linha está fora do `se`.

Outras decisões:

3. **A fila da sessão é fixada no início.** `iniciarSessao` calcula os cartões devidos
   naquele instante e cada um é respondido uma única vez, o que garante que toda sessão
   termina. Um cartão com `q < 3` **não** reentra na fila da sessão corrente: o próprio
   SM-2 já o reagenda para o dia seguinte (`I = 1`).
4. **Cartão nunca revisado tem `proximaRevisao = null`** e está devido desde sempre. A
   ordem da fila é determinística: novos primeiro, depois prazo mais antigo, desempate por id.
5. **Todo o estado é imutável.** `revisar`, `responder` e afins devolvem novos valores,
   nunca alteram o que recebem — o que deixa o caminho aberto para a persistência e a
   reconciliação dos Incrementos 2 e 3.
6. **Nota inválida é erro, não silêncio.** `revisar` rejeita qualquer `q` fora de 0..5
   inteiro, assim como `parseDeck` rejeita deck malformado.

## Incremento 1 — critérios de aceitação

| Critério | Onde está | Verificação |
| --- | --- | --- |
| dado o deck, o agendador apresenta apenas os cartões devidos | `src/scheduler/devidos.ts`, `src/session/sessao.ts` | `devidos.test.ts`, `sessao.test.ts` |
| a nota `q` é registrada e o próximo intervalo é recomputado conforme a §4 | `src/scheduler/sm2.ts` | `sm2.test.ts` (19 testes sobre a §4) |
| uma sessão de revisão pode ser concluída do início ao fim | `src/session/sessao.ts` | `sessao.test.ts`, além do teste de ponta a ponta em navegador |

Fora de escopo por decisão do brief (§3), e portanto ausentes: áudio, ordem de traços,
autoria de lições, autenticação.

Sem persistência e sem rede neste incremento: recarregar a página zera o progresso —
é o Incremento 2 que resolve isso.

## Uso

Espaço ou Enter revela a resposta; as teclas `0`–`5` registram a nota. Os mesmos comandos
estão disponíveis por clique.
