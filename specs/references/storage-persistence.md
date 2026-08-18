# Persistência no navegador — cotas, durabilidade e despejo

Fonte: MDN, *Storage quotas and eviction criteria*,
<https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria>
(verificado 2026-08-18).

## Best-effort (padrão) vs. persistent

- **Best-effort** — o padrão de todas as APIs de armazenamento. O navegador **pode despejar**
  os dados sem avisar quando o dispositivo fica sem espaço, usando política LRU entre origens.
- **Persistent** — só é apagado por ação explícita do usuário. Exige opt-in:

```javascript
navigator.storage.persist().then(persistent => { /* true = concedido */ });
```

Firefox pede confirmação ao usuário; Chrome/Edge/Safari decidem automaticamente com base no
histórico de interação, sem prompt.

## O que conta na cota

IndexedDB, Cache API (a mesma usada pelo service worker), OPFS, `localStorage`/`sessionStorage`
e cookies. `localStorage` é **síncrono** (bloqueia a thread principal), limitado a ~5 MiB por
origem (10 MiB somando `sessionStorage`), e lança `QuotaExceededError` ao estourar.

## Quando o navegador despeja

1. **Pressão de disco** — LRU entre origens; origens *persistent* são puladas.
2. **Máximo do navegador excedido** — p.ex. Chrome, ~80% do disco no total.
3. **Despejo proativo do Safari** — origens **sem interação do usuário por 7 dias** têm os
   dados criados por script apagados.

**Despejo é tudo-ou-nada por origem:** quando uma origem é despejada, *todos* os seus dados
vão juntos — IndexedDB e Cache Storage inclusive. A motivação declarada é justamente evitar
estado inconsistente entre APIs.

## Consequências para este projeto

1. "Sobrevive a recarga" (I2) é trivialmente satisfeito por qualquer das APIs; **sobreviver ao
   navegador** não é — exige `navigator.storage.persist()`, e mesmo assim é concessão, não garantia.
2. O despejo de 7 dias do Safari colide de frente com o produto: um estudante que passa uma
   semana sem abrir o app pode perder o progresso local. É exatamente o caso em que o
   Incremento 3 (progresso também no remoto) deixa de ser conveniência e vira rede de segurança.
3. Como o despejo apaga **origem inteira**, não existe cenário "perdi o cache do casco mas
   mantive o progresso" nem o inverso: os dois somem juntos. Isso simplifica o raciocínio de
   recuperação — só há um estado degradado a tratar, o zerado.
4. `localStorage` sendo síncrono e pequeno é argumento contra usá-lo para o log de revisões,
   que cresce com o uso. Decisão de mecanismo fica para a Fase 1.
