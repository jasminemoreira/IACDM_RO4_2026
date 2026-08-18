# Service worker e estratégias de cache — referência

Fonte: MDN, *Caching* (guia de PWA),
<https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching>
(verificado 2026-08-18).

## Pré-requisito de plataforma

Service worker exige **contexto seguro**: `https`, com `localhost` tratado como seguro para
desenvolvimento. Abrir o app por `file://` **não** registra service worker — logo a partida
a frio offline (I2, critério 2) não é verificável sem servir por http(s) em localhost ou https.

## Estratégias nomeadas

| Estratégia | Como opera | Indicada para | Custo |
|---|---|---|---|
| **Cache only** | Serve só do cache; recursos entram no `install` (precache) | Casco do app, versionado junto com o build | Se o cache foi limpo e não há *fallback* de rede, quebra |
| **Cache first** (com *fallback* de rede) | Cache; se ausente, rede, e guarda a resposta | Estáticos que não mudam dentro de uma versão: HTML/JS/CSS | Conteúdo velho até o SW atualizar |
| **Stale-while-revalidate** | Devolve o cache na hora e atualiza o cache pela rede em paralelo | Recursos onde responsividade importa e frescor importa um pouco | Usuário vê a versão anterior nesta visita |
| **Network first** (com *fallback* de cache) | Rede; se falhar, cache | Conteúdo que precisa estar fresco mas cujo cache é melhor que nada | Mais lento; paga o timeout de rede |
| **Network only** | Sempre rede | Recurso em que dado velho é inaceitável | Não funciona offline |

## Precache do casco no `install`

```javascript
const cacheName = "MyCache_1";
const precachedResources = ["/", "/app.js", "/style.css"];

async function precache() {
  const cache = await caches.open(cacheName);
  return cache.addAll(precachedResources);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});
```

`event.waitUntil()` faz a instalação só concluir se o `addAll` concluir: ou o casco inteiro
está em cache, ou o service worker não instala. É esse tudo-ou-nada que torna a **partida a
frio offline** uma garantia e não um acaso.

Nota da fonte: o service worker instala na **primeira visita ao site**, não no momento em que
o usuário "instala" a PWA. Portanto a partida a frio offline exige que tenha havido ao menos
uma carga online anterior — premissa a declarar explicitamente na arquitetura.

MDN alerta ainda que o cache pode ser limpo pelo navegador ou pelo usuário; manter *fallback*
de rede é recomendado mesmo para recursos precacheados.
