# Replicação otimista e reconciliação — referência

O Incremento 3 é, tecnicamente, um problema de replicação otimista: duas réplicas aceitam
escritas sem coordenação enquanto offline e precisam convergir depois.

## Fontes

- **Saito, Y. & Shapiro, M. (2005).** *Optimistic replication.* **ACM Computing Surveys 37**(1), 42–81.
  PDF: <https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr-2003-60.pdf>
  (verificado 2026-08-18). Survey seminal. Enuncia os quatro desafios do regime otimista:
  **ordenar operações**, **detectar e resolver conflitos**, **propagar mudanças** e
  **limitar a divergência entre réplicas**.
- **Shapiro, M., Preguiça, N., Baquero, C. & Zawirski, M. (2011).** *Conflict-free Replicated
  Data Types.* SSS 2011, LNCS 6976, 386–400.
  <https://link.springer.com/chapter/10.1007/978-3-642-24550-3_29>
  Tipos cuja operação de junção é comutativa, associativa e idempotente convergem
  deterministicamente **independentemente da ordem de entrega** (*strong eventual consistency*).
- **Shapiro, M. (2009).** *Optimistic Replication and Resolution*, Encyclopedia of Database Systems.
  <https://www.lip6.fr/Marc.Shapiro/papers/2009/optimistic-replication-Encyclopedia-DB-systems-2009.pdf>
- **Bayou** (via os surveys acima): detecção de conflito + procedimento de fusão fornecido pela
  aplicação; escritas tentativas para disponibilidade, ordem única entre réplicas para as
  escritas comitadas.

## Famílias de resolução e o que cada uma custa

| Família | Como resolve | Perde escrita? |
|---|---|---|
| **Last-writer-wins (LWW)** sobre o estado derivado | Carimbo de tempo maior vence; o outro lado é descartado | **Sim, por construção** — descarta o trabalho do perdedor |
| **Operational transformation** | Transforma operações concorrentes para que comutem | Não, mas exige transformação correta por par de operações |
| **CRDT** | Junção comutativa/associativa/idempotente | Não, dentro da semântica do tipo |
| **Merge procedure da aplicação** (Bayou) | Regra de fusão específica do domínio | Depende da regra escrita |

## Leitura direcionada ao critério do I3

O critério 2 do Incremento 3 — "**nenhum dos dois lados perde revisões já registradas**" —
**exclui LWW sobre o estado SM-2 derivado**: se a réplica A revisou `c001` e a B também,
escolher o `(n, EF, I)` de um lado descarta a revisão do outro. O critério não é sobre qual
estado vence, é sobre nenhuma revisão sumir.

Isso empurra a solução para a família CRDT/log: se a unidade replicada for o **evento de
revisão** `(cartão, q, instante, réplica)` num conjunto que só cresce, a junção é a **união** —
comutativa, associativa e idempotente, portanto um G-Set no sentido de Shapiro et al. (2011),
com convergência determinística garantida. O estado SM-2 deixa de ser dado replicado e passa a
ser **função** do log: uma dobra determinística sobre os eventos em ordem total.

Duas consequências que a literatura obriga a encarar, e que a Fase 1 terá de resolver:

1. **Ordem importa aqui.** O SM-2 não é comutativo: aplicar `q=5` depois `q=2` não dá o mesmo
   estado que a ordem inversa. A união dos eventos converge, mas a dobra só converge se a
   **ordem total for a mesma nas duas réplicas** — é o desafio "ordenar operações" de
   Saito & Shapiro. Um critério de desempate determinístico e estável é obrigatório
   (p.ex. `(instante, id da réplica, id do cartão)`), e relógios de parede entre dispositivos
   não são confiáveis para isso sozinhos.
2. **O log cresce sem limite.** "Limitar a divergência" e o custo de espaço são problemas
   reconhecidos do regime otimista; compactação (*snapshot* + descarte de prefixo) é a saída
   usual, e qualquer compactação precisa preservar a propriedade "nenhuma revisão perdida"
   no sentido observável.
