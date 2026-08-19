# Protocolo de commits (§7 de REQUISITOS.md)

§7 é requisito normativo do projeto e, até a Fase 2, **não tinha dono nem
mecanismo** (achado REG-01). Este documento é o dono.

> "Comitar a cada passo com significado próprio. Não agrupar um incremento inteiro
> num único commit, e não comitar apenas ao final."

## Regra operacional (Fase 5)

Um commit por **passo com significado próprio**, tipicamente:

1. um módulo implementado com sua interface;
2. uma correção de achado da matriz, referenciando o id (ex.: `resolve SEC-02`);
3. um conjunto de testes de um módulo;
4. um ativo produzido (deck v1, deck v2, ícones).

**Proibido:** um commit por incremento; um commit final juntando tudo.

## Rastreabilidade

Mensagem de commit cita o módulo (nome exato da tabela de arquitetura) e, quando
aplicável, o id do achado ou do critério (`VAL-1.5`, `ASS-01`). Isso é o que permite
a uma análise posterior ligar código a decisão de projeto.
