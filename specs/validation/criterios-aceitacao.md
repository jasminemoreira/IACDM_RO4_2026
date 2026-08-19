# Critérios de aceitação — verificáveis

Derivados de REQUISITOS.md §6 mais as decisões de P0. Cada critério tem
identificador estável, usado pelo Mapa de Testes da Fase 6.

## Incremento 1 — núcleo de revisão

| id | Critério | Verificação |
|---|---|---|
| **VAL-1.1** | Dado o deck, a sessão apresenta **apenas** cartões devidos (vencimento ≤ agora) | Fixar relógio; cartão com due futuro não aparece na fila |
| **VAL-1.2** | A nota `q` é registrada e `n`, `EF`, `I` são recomputados exatamente pela §4 | Tabela de casos: entrada `{n,EF,I,q}` → saída esperada, incluindo q<3 |
| **VAL-1.3** | `EF` nunca fica abaixo de 1,3 | q=0 repetido: EF converge a 1,3 e para |
| **VAL-1.4** | `EF` é atualizado **também** quando q<3 (D1 — §4 prevalece sobre o original) | q=0 com EF=2,5 → EF=1,7 (não 2,5) |
| **VAL-1.5** | `I` = `Math.round(I_anterior × EF)` (half-up, D3) | I=6, EF=2,5 → 15; casos de .5 explícitos |
| **VAL-1.6** | n=0 → I=1; n=1 → I=6; senão fórmula (§4) | primeiras três revisões de um cartão novo |
| **VAL-1.7** | Falha (q<3) zera `n` e põe I=1 | cartão maduro falhado volta ao início |
| **VAL-1.8** | Uma sessão pode ser concluída do início ao fim | fila fixada no início; sem reaparição intra-sessão (D2) |
| **VAL-1.9** | Vencimento = início do dia local da revisão + I dias (D4) | revisar às 08h e às 23h do mesmo dia → mesmo vencimento |
| **VAL-1.10** | A UI expõe 4 notas: 0 / 3 / 4 / 5 (D5); o agendador aceita 0..5 | teste de unidade cobre 0..5; teste de UI cobre os 4 botões |

## Incremento 2 — offline e persistência

| id | Critério | Verificação |
|---|---|---|
| **VAL-2.1** | Service worker registrado, com estratégia de cache **declarada por escrito** | documento existe e descreve a estratégia por tipo de ativo |
| **VAL-2.2** | **Partida a frio offline** funciona | rede desligada + reload sem sessão viva → sessão completa executável |
| **VAL-2.3** | Deck e progresso persistem localmente e sobrevivem a recarga | revisar, recarregar, progresso idêntico |
| **VAL-2.4** | Modelo de conteúdo versionado | o deck carrega versão; a aplicação a lê |
| **VAL-2.5** | Troca de versão do deck migra o progresso **sem perda**: adicionados entram como novos; removidos preservam progresso inativo; editados com mesmo id preservam progresso | cenário v1→v2 com os três casos simultâneos, e v2→v1 sem dano |

## Incremento 3 — sincronização com conflito

| id | Critério | Verificação |
|---|---|---|
| **VAL-3.1** | Dois estados locais divergentes sobre os mesmos cartões produzem resolução **definida e documentada** | a regra está escrita antes do teste; o teste a exercita |
| **VAL-3.2** | **Nenhum dos dois lados perde revisões já registradas** | contar revisões antes e depois: união exata, nada descartado |
| **VAL-3.3** | O comportamento sob conflito é **reproduzível a partir de um cenário descrito** | cenário em specs/datasets; rodar duas vezes → resultado idêntico |
| **VAL-3.4** | A reconciliação é independente do fuso de quem reconcilia (decisão A) | reconciliar o mesmo par de estados sob dois fusos → estado idêntico |
| **VAL-3.5** | A reconciliação converge: aplicar A←B e B←A leva ambos ao mesmo estado | propriedade de convergência testada nos dois sentidos |

## Casos de borda obrigatórios

| id | Caso |
|---|---|
| **EDGE-1** | Nenhum cartão devido hoje (estado vazio precisa de feedback, não tela morta) |
| **EDGE-2** | Todos os cartões novos (primeira sessão de todas) |
| **EDGE-3** | q=0 repetido até `EF` atingir o piso 1,3 |
| **EDGE-4** | Duas revisões do mesmo cartão com **timestamp idêntico** em dispositivos distintos (desempate determinístico) |
| **EDGE-5** | Reconciliar quando um lado não tem revisão alguma |
| **EDGE-6** | Recarga no meio de uma sessão (a fila fixada sobrevive ou é recomputada? — decidir em P1) |
| **EDGE-7** | Cliques rápidos/duplos no botão de nota (dupla contagem da mesma revisão) |
