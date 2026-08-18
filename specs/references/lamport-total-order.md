# Ordem total determinística entre réplicas — referência

Problema herdado da decisão de reconciliação: a **união** dos eventos converge sozinha
(G-Set), mas o SM-2 **não comuta** — `q=5` seguido de `q=2` não produz o mesmo `(n, EF, I)`
que a ordem inversa. Logo a dobra só converge se as duas réplicas ordenarem os eventos
**exatamente igual**, e a premissa P-c diz que relógios de parede divergem.

## Fonte

**Lamport, L. (1978).** *Time, Clocks, and the Ordering of Events in a Distributed System.*
**Communications of the ACM 21**(7), julho de 1978, 558–565.
<https://www.microsoft.com/en-us/research/publication/time-clocks-ordering-events-distributed-system/>
· PDF em <https://lamport.azurewebsites.net/pubs/time-clocks.pdf>
· cópia acadêmica: <https://www.cs.cmu.edu/afs/cs/academic/class/15712-f08/www/lectures/Lamport78lecture.pdf>
(verificado 2026-08-18). Prêmio Dijkstra em Computação Distribuída (2000) e ACM SIGOPS Hall of Fame (2007).

## O que o artigo dá

1. A relação *happened-before* define apenas uma **ordem parcial** dos eventos.
2. Relógios lógicos satisfazendo a *Clock Condition* respeitam essa ordem parcial sem
   exigir relógios físicos sincronizados.
3. A ordem parcial é estendida a uma **ordem total arbitrária** desempatando por um
   ordenamento total arbitrário dos processos:

   > `(m.timestamp, m) < (n.timestamp, n)` sse `m.timestamp < n.timestamp`,
   > ou `m.timestamp == n.timestamp` e `m < n` (identificador de processo).

## Aplicação direta aqui

A chave de ordenação de um `ReviewEvent` deve ser um par **(carimbo, identificador de réplica)**,
com o identificador desempatando de forma total e estável. Isso torna a ordem total idêntica
nas duas réplicas **por construção**, independentemente da ordem de chegada dos eventos —
que é precisamente a condição para que a dobra do SM-2 convirja.

Aviso que a fonte torna explícito e que vale registrar: **carimbo de parede sozinho não basta**
como carimbo, porque não satisfaz a Clock Condition entre máquinas com relógios divergentes.
Qual carimbo usar (relógio lógico, híbrido, ou de parede com desempate declarado como
limitação aceita) é decisão da **Fase 1** — esta referência fixa apenas que o desempate por
identificador de réplica é obrigatório e suficiente para totalidade.
