# Estado da arte e lacuna — apps de repetição espaçada

## Anki / AnkiWeb / AnkiDroid

Referência de mercado em SRS. Fonte: *Syncing with AnkiWeb*, manual oficial,
<https://docs.ankiweb.net/syncing.html> (verificado 2026-08-18, via busca).

O que o manual declara sobre conflito:

> "the first sync can only sync changes in one direction, if you have added different content
> to different devices or profiles before setting syncing up, **content on one device will be
> lost** if you overwrite it with the content from the other device."

E, para o caso de fusão impossível depois do primeiro sync:

> "Occasionally you may end up in the position where your cards on AnkiDroid can not be
> automatically merged with the cards on AnkiWeb. In this case it's necessary to choose to
> either upload to or download from AnkiWeb, **which would overwrite any changes on the other side**."

Ou seja: no caminho normal Anki funde; no caminho de conflito duro ele **degrada para
sobrescrita de um lado** (*full sync* / *one-way sync*), e a orientação ao usuário é fazer
backup e fundir à mão via export.

**Lacuna, e é exatamente o nosso critério.** O I3 exige "nenhum dos dois lados perde revisões
já registradas" — precisamente o que o líder de mercado não garante no caminho de conflito.
Não é uma crítica ao Anki (o objeto sincronizado dele é a coleção inteira, com esquema,
mídia e decks editáveis, um problema muito mais largo); é a delimitação do que aqui é
tratável: nosso deck é **fixo e não editável** (§2), então o único dado divergente é o
progresso, e progresso pode ser modelado como log de eventos que só cresce.

## SuperMemo

Origem do algoritmo (SM-2 e sucessores até SM-18). Fonte do algoritmo em
[../references/sm2-wozniak.md](../references/sm2-wozniak.md). Desktop-cêntrico; sincronização
não é a proposta de valor. Serve como **referência normativa do agendador**, não como
concorrente de arquitetura.

## Duolingo, Pleco, Skritter (domínio chinês)

Cobrem áudio, ordem de traços, autoria/edição de lições e conta de usuário — **todos os quatro
itens explicitamente fora de escopo** (§3). Citados aqui para registrar que a exclusão é
consciente e não por desconhecimento do que o mercado faz: o produto aqui é deliberadamente
mais estreito e mais fundo — o valor está na correção do agendamento e da reconciliação, não
na largura de recursos.

## Posicionamento resultante

| Eixo | Mercado | Este projeto |
|---|---|---|
| Conteúdo | usuário cria e edita | deck JSON fixo, entrada imutável |
| Agendador | proprietário e evolutivo (SM-17/18, FSRS) | SM-2 congelado e auditável contra a fonte |
| Offline | comum | requisito de aceitação, com partida a frio verificada |
| Conflito | fusão parcial, sobrescrita no caso duro | **nenhuma revisão perdida**, resolução documentada e reproduzível |
