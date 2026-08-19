# Persistência no navegador — opções e limites

**Fontes:**
- MDN, *Storage quotas and eviction criteria* —
  https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Microsoft Edge, *Store data on the device (offline)* —
  https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/offline
(Recuperado em 2026-08-18.)

| Critério | localStorage | IndexedDB |
|---|---|---|
| API | síncrona, bloqueia a thread principal | assíncrona, transacional |
| Tipos | apenas string | valores structured-cloneable (Date, Blob, ArrayBuffer, Map, Set…) |
| Capacidade | ~5 MB por origem | cota por origem, tipicamente centenas de MB |
| Acesso pelo service worker | **não** | **sim** |
| Transações / atomicidade | não | sim |

**Recomendação da literatura:** IndexedDB é a opção indicada para PWA — não
bloqueia a thread principal e é acessível tanto pelo front-end quanto pelo
service worker. Wrappers usuais: `idb` (promise-based, mínimo), `Dexie.js`,
`localForage`.

**Nota de durabilidade:** nenhum dos dois é imune a evicção do navegador sob
pressão de armazenamento. `navigator.storage.persist()` é o mecanismo para
solicitar armazenamento persistente (MDN, mesmo verbete).

Escolha concreta (qual, e com ou sem wrapper) pertence à Fase 1.
