# Vocabulário do domínio

Termos com significado fixo neste projeto. Sinônimos à esquerda da barra são proibidos em
código, testes e documentos — um termo, um nome.

| Termo | Definição operacional | Onde aparece |
|---|---|---|
| **deck** | Coleção fixa de cartões, entrada da aplicação, formato §5. Imutável em execução: a app não cria nem edita conteúdo | REQUISITOS §2, §5 |
| **versão do deck** | Identificador do modelo de conteúdo. Sua troca dispara migração de progresso | §6, I2 crit. 4 |
| **cartão** (*card*) | Item de vocabulário: `{id, hanzi, pinyin, gloss}`. O `id` é a **identidade** e é estável entre versões do deck | §5 |
| **progresso** | Estado de agendamento por cartão, derivado das revisões. Nunca faz parte do deck | I1, I2 |
| **n** | Repetições consecutivas bem-sucedidas (`q≥3`). Zera na falha. Inteiro ≥ 0 | §4 |
| **EF** | *Easiness factor*. Inicial 2,5; piso 1,3. Multiplica o intervalo | §4 |
| **I** | Intervalo, em **dias**, até a próxima apresentação | §4 |
| **q** | Nota de recordação, inteiro 0–5. `q≥3` é acerto; `q<3` é falha | §4 |
| **revisão** | Evento `(cartão, q, instante, réplica)`. Unidade que a sincronização **não pode perder** | I3 crit. 2 |
| **devido** (*due*) | Cartão cuja data de vencimento ≤ instante corrente. Só cartões devidos entram na sessão | I1 crit. 1 |
| **vencimento** | `instante da última revisão + I dias`. Cartão nunca revisado é devido imediatamente | derivado de §4 |
| **sessão de revisão** | Percurso do conjunto de devidos apurado no início, do começo ao fim | I1 crit. 3 |
| **partida a frio offline** | Abrir a aplicação com a rede desligada e obter a interface funcional | I2 crit. 2 |
| **réplica** | Um estado local completo (um dispositivo). O cenário do I3 tem duas | I3 |
| **divergência** | Duas réplicas registraram revisões dos mesmos cartões sem se ver | I3 crit. 1 |
| **reconciliação** | Função determinística que funde duas réplicas num estado resolvido | I3 crit. 1 |
| **migração** | Transporte do progresso de uma versão do deck para outra, sem descartar revisões | I2 crit. 4 |

## Termos deliberadamente ausentes

Não existem neste domínio, e usá-los é sinal de escopo vazando: *usuário*/*conta*/*login*
(§3 exclui autenticação), *lição*/*curso*/*autoria* (§3), *áudio*/*pronúncia tocada* (§3),
*traço*/*ordem de traços* (§3), *baralho do usuário*/*cartão criado* (§2: a app não cria conteúdo).

## Nota sobre "sem perda"

"Sem perda" tem, neste projeto, um sentido único e forte, em **dois** lugares — migração de
versão do deck (I2 crit. 4) e reconciliação (I3 crit. 2): **nenhuma revisão já registrada é
descartada**. Não significa "o estado final é o mais recente", nem "os dados do lado que
venceu estão intactos".
