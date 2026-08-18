# Braço C do piloto RO4 — descartado em 2026-08-18

Descarte integral da execução do braço C. O braço A (`hanzi-pwa-w1/`) **não** é afetado:
permanece válido, concluído nos três incrementos, e seus achados seguem de pé.

## Por quê

**1. Exposição do braço ao braço A e ao desenho do estudo.** Às 18:25:58 um `git fetch`
dentro de `hanzi-pwa-w2/` trouxe para dentro do repositório:

```
refs/remotes/origin/braco-A       histórico completo do braço A, com todo o código
refs/remotes/origin/coordenacao   PILOTO.md, LOG-OPERACAO.md, CONGELAMENTO.txt
refs/tags/inc1-fim inc2-fim inc3-fim   tags do braço A
```

O `PILOTO.md` — hipótese, braço esperado, local onde o efeito é esperado — passou a ser
alcançável de dentro do braço por `git show origin/coordenacao:PILOTO.md`. É a contaminação
que o §0 do `PILOTO.md` descreve: um agente que lê o desenho é um agente informado do
resultado desejado, o que contamina o **tratamento**, não apenas o artefato.

O que é detectável é o **acesso**; a **leitura** não é detectável nem refutável. O último
commit do incremento 1 é das 18:21:11 e portanto anterior à exposição, mas os incrementos 2
e 3 rodariam sob ela.

**2. Granularidade de commit incompatível com a DV.** O incremento 1 chegou em 2 commits de
código (861 e 976 linhas), contra 8 no braço A. A DV primária é computada por commit: uma
janela pós-`t₀` de um único commit não tem como exibir churn. Não é ausência de retrabalho,
é ausência de granularidade para observá-lo — e torna os braços incomparáveis por um motivo
que nada tem a ver com método. O §7 do `REQUISITOS.md`, congelado e idêntico nos dois braços,
já exige o contrário.

Qualquer um dos dois motivos bastaria. Juntos não deixam alternativa.

## O que fica registrado

- estado do braço como ficou, em `hanzi-pwa-w2/`, com as 12 fases de `specs/` e os 2 commits de código
- no remoto, o ramo `braco-C-descartado`
- evidência do fetch (`FETCH_HEAD` e reflog) preservada fora do braço
- medição do incremento 1 antes do descarte: `t₀` 15/16 · churn 41 · `|M|`=8 `|E|`=12 `|I|`=73 · LOC 1221

## O que NÃO se descarta

Os achados de medibilidade do piloto não dependem de o tratamento estar limpo, e seguem
válidos — inclusive os dois que este braço produziu: a posição de `t₀` em 15/16 e a
dependência da DV em relação ao tamanho do commit. Ver `LOG-OPERACAO.md` §3e e §4b.
