# Glossário do domínio

Vocabulário canônico deste projeto. Termos em português no texto, identificadores
em inglês no código (decisão de P1 confirmará).

| Termo | Definição operacional | Exemplo |
|---|---|---|
| **Cartão** (card) | Unidade de conteúdo revisável. Imutável, vem do deck. | `{id:"c001", hanzi:"你好", pinyin:"nǐ hǎo", gloss:"hello"}` |
| **Deck** | Coleção fixa de cartões em JSON (§5). O app não cria nem edita. | `deck.json` versionado no repositório |
| **Revisão** (review) | Ato de o usuário atribuir uma nota `q` a um cartão num instante. | `{cardId:"c001", q:4, at:"2026-08-18T22:00:00Z"}` |
| **Nota** (`q`) | Qualidade da resposta, 0–5 (escala de Wozniak). q ≥ 3 = acerto. | q=5 resposta perfeita; q=0 branco total |
| **`n`** | Número de repetições bem-sucedidas consecutivas do cartão. Zera na falha. | após 2 acertos seguidos, n=2 |
| **`EF`** (fator de facilidade) | Multiplicador de crescimento do intervalo. Inicial 2,5; piso 1,3. | EF=2,5 → intervalos crescem 2,5× |
| **`I`** (intervalo) | Dias até a próxima apresentação do cartão. | I=6 → volta em 6 dias |
| **Vencimento** (due) | Instante a partir do qual o cartão deve ser apresentado. Derivado de `I`. | (semântica exata a decidir — ver sm2-divergencias.md D4) |
| **Cartão devido** | Cartão cujo vencimento já passou no instante da sessão. | §6 Inc.1: "o agendador apresenta apenas os cartões devidos" |
| **Sessão de revisão** | Percurso do usuário pelos cartões devidos, do início ao fim. | §6 Inc.1: "pode ser concluída do início ao fim" |
| **Agendador** (scheduler) | Componente que decide o que é devido e recomputa `n`, `EF`, `I` pela §4. | pura, sem I/O |
| **Progresso** | Estado de aprendizado do usuário. É o que persiste e o que sincroniza. | log de revisões e/ou `{n,EF,I}` por cartão |
| **Modelo de conteúdo versionado** | O deck carrega uma versão; trocar de versão exige migrar o progresso sem perda (§6 Inc.2). | `deckVersion: 2` |
| **Partida a frio offline** | Abrir o app com a rede desligada, sem sessão anterior viva, e conseguir revisar. | DevTools → Offline → reload |
| **Duplo local** (remoto simulado) | Substituto local do armazenamento remoto, atrás da interface de transporte. | decidido em P0 |
| **Reconciliação** | Produzir um estado único a partir de dois estados locais divergentes, sem perder revisões. | §6 Inc.3 |

## Termos vagos já resolvidos (P0)

| Termo vago (origem) | Resolução |
|---|---|
| "funciona sem rede" (§1) | Offline total após primeira visita; partida a frio offline obrigatória |
| "fornecido como entrada" (§2) | Arquivo estático `deck.json` servido pelo app e cacheado pelo SW |
| "remoto ... ou duplo local" (§6 Inc.3) | Duplo local, atrás de interface de transporte |
| "resolução definida e documentada" (§6 Inc.3) | (a definir em P1 — campo de opções em technical/sincronizacao-conflito.md) |

## Campo teórico

- **Repetição espaçada** — psicologia da memória; curva de esquecimento
  (Ebbinghaus), efeito de espaçamento. Algoritmo fixado: SM-2 (Wozniak, 1990).
- **PWA / offline-first** — engenharia web; service worker, cache API, IndexedDB.
- **Sistemas distribuídos** — convergência de réplicas, CRDT, relógios lógicos.
