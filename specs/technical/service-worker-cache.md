# Estratégias de cache de service worker

**Fonte:** Workbox / Chrome for Developers —
https://developer.chrome.com/docs/workbox/caching-strategies-overview/
Modelo app shell: https://developer.chrome.com/docs/workbox/app-shell-model
(Recuperado em 2026-08-18.)

## As cinco estratégias canônicas

| Estratégia | Como funciona | Recomendada para |
|---|---|---|
| **Cache Only** | Serve exclusivamente do cache. Ativos precisam ser pré-cacheados na instalação do SW; só mudam quando o próprio SW muda. | Estáticos que não precisam atualizar e devem sempre existir offline |
| **Network Only** | Passa direto para a rede (não chama `event.respondWith()`). | Conteúdo que exige frescor garantido. Indisponível offline |
| **Cache First, falling back to Network** | Consulta o cache; se houver, serve. Se não, busca na rede e grava no cache. | Estáticos (CSS, JS, imagens, fontes), **especialmente versionados por hash** — dispensa checagem de frescor |
| **Network First, falling back to Cache** | Tenta rede (e atualiza o cache); offline, devolve a última versão cacheada. | HTML e respostas de API onde se prefere o recente mas se aceita o último conhecido |
| **Stale-While-Revalidate** | Serve o cache imediatamente e atualiza em segundo plano. | Coisas cuja atualidade importa mas não é crítica |

## Prescrições aplicáveis a este projeto

- O SW no **root** (`/sw.js`) para controlar toda a origem.
- **Não** cachear o próprio arquivo do service worker — o navegador tem
  facilidade separada para isso.
- Combinar **precache do app shell** na instalação com estratégia por tipo de
  ativo é o padrão para partida a frio offline.
- Ativos com hash no nome ⇒ Cache First é seguro e imutável.

## Consequência para o Incremento 2 de REQUISITOS.md §6

A aceitação exige *"service worker registrado, com estratégia de cache declarada
por escrito"* e *"partida a frio offline funciona"*. Isso descarta Network Only
para o app shell e descarta depender de rede para o `deck.json`
(fonte do deck decidida em P0: arquivo estático servido pelo app).
A escolha por ativo entra na arquitetura (Fase 1), não aqui.
