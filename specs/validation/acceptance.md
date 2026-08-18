# Critérios de validação

Cada linha é verificável. A coluna **módulo** é o nome exato da tabela de V(4), e é por ela que
o inventário de escopo da Fase 5 e o mapa de testes da Fase 6 se ligam a este arquivo.

## Incremento 1 — núcleo de revisão

| id | Critério (REQUISITOS §6 / S-n da Fase 0) | Módulo | Como se verifica |
|---|---|---|---|
| VAL-01 | Dado o deck, o agendador apresenta **apenas** os cartões devidos | session | Conjunto apresentado = `{c : dueAt(c) ≤ agora}`, com relógio injetado |
| VAL-02 | A nota `q` é registrada e o próximo intervalo é recomputado conforme a §4 | scheduler, storage | Vetores V-1 a V-4 de `specs/datasets/sm2-vectors.md`, conferidos valor a valor |
| VAL-03 | A ordem de avaliação é a da §4: `I` usa o `EF` **anterior**, e o `EF` é atualizado depois | scheduler | Vetor V-3, passo 3: `round(6 × 2.7) = 16` |
| VAL-04 | `EF` nunca fica abaixo de 1,3 | scheduler | Vetor V-2: cinco zeros, piso alcançado no 2º e mantido |
| VAL-05 | Falha (`q<3`) zera `n` e põe `I=1`, e o cartão **sai da sessão corrente** | scheduler, session | Nenhuma reapresentação intra-sessão; decisão de leitura literal da §4 |
| VAL-06 | Uma sessão pode ser concluída do início ao fim | session | Termina em ≤ `|devidos na abertura|` apresentações, sempre |
| VAL-07 | Sessão vazia é resultado válido, não erro | session, ui | Deck sem devidos abre e conclui sem exceção |

## Incremento 2 — offline e persistência

| id | Critério | Módulo | Como se verifica |
|---|---|---|---|
| VAL-08 | *Service worker* registrado, com estratégia de cache **declarada por escrito** | service-worker | Registro efetivo + tabela por recurso em `specs/technical/architecture.md` |
| VAL-09 | Partida a frio **offline** funciona | service-worker, ui | Uma carga online, fechar, rede desligada, abrir: interface funcional |
| VAL-10 | Deck e progresso persistem localmente e sobrevivem a recarga | storage | Progresso idêntico antes e depois de recarregar |
| VAL-11 | O modelo de conteúdo é versionado | deck | `versionOf` distingue `deck-v1.json` de `deck-v2.json` |
| VAL-12 | Troca de versão do deck migra o progresso **sem perda** | deck, storage | v1→v2: zero eventos descartados; removidos retidos e inativos; editados com mesmo id mantêm progresso; adicionados entram novos |
| VAL-13 | Progresso de cartão removido **ressuscita** se o id voltar | storage | v1→v2→v1: o progresso de `c048`, `c049`, `c050` volta intacto |

## Incremento 3 — sincronização com conflito

| id | Critério | Módulo | Como se verifica |
|---|---|---|---|
| VAL-14 | Dois estados locais divergentes produzem resolução **definida** | sync, review-log | Cenário de `specs/examples/conflict-scenario.md`, tabela de resultado esperado |
| VAL-15 | A resolução é **documentada** | review-log | O documento existe e descreve união + dobra em ordem total |
| VAL-16 | **Nenhum dos dois lados perde revisões já registradas** | sync, review-log, event-store | 6 de 6 eventos no log resolvido, e o `EF` de `c001` = 2.28, que não é o de A nem o de B |
| VAL-17 | A reconciliação **converge**: ordem de chegada não altera o resultado | review-log | A-recebe-B e B-recebe-A produzem estado idêntico |
| VAL-18 | A reconciliação é **idempotente** | review-log, event-store | Sincronizar duas vezes não muda nada |
| VAL-19 | O comportamento sob conflito é **reproduzível** a partir do cenário descrito | event-store, sync | Roteiro executado por teste, sem relógio real |
| VAL-20 | Falha de rede não perde revisão: o que não foi entregue continua pendente | sync, storage | Pendente = evento com `sseq` nulo; falha não marca entrega |

## Restrições de projeto — verificáveis

| id | Restrição | Origem | Como se verifica |
|---|---|---|---|
| VAL-21 | Módulos são diretórios de primeiro nível sob `src/`, com ponto de entrada explícito | §2 | Teste de fronteira: nenhum import alcança arquivo interno de outro módulo |
| VAL-22 | O deck é lido no formato exato da §5 e nunca escrito pela aplicação | §2, §5 | Array puro aceito; nenhum caminho de escrita no deck |
| VAL-23 | Nada fora de escopo foi construído | §3 | Ausência de áudio, ordem de traços, autoria e autenticação |
| VAL-24 | `EF` não é arredondado na serialização | A-16 | Ida e volta pelo armazenamento preserva o valor bit a bit |
| VAL-25 | Cada premissa numerada A-1…A-19 tem teste que falharia se ela deixasse de valer, ou razão declarada | Fase 1 | `specs/validation/premise-coverage.md`, na Fase 6 |
| VAL-26 | Cada achado 🔴 da matriz tem teste de regressão, ou razão declarada | Fase 2 | `specs/validation/critical-coverage.md`, na Fase 6 |
