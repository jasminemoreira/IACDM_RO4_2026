# Estratégia de cache — declaração escrita (§6 Inc.2)

Artefato exigido pelo critério de aceitação do Incremento 2 e designado pelo
contrato C-13. Mantido em sincronia com a config do módulo `service-worker`.
Base de referência: `specs/technical/service-worker-cache.md`.

| Ativo | Estratégia | Razão |
|---|---|---|
| App shell (`index.html`) | **Precache** (Cache Only via manifesto) | Partida a frio offline exige que exista sem rede (VAL-2.2) |
| JS/CSS com hash no nome | **Precache** + Cache First | Imutáveis por construção — dispensa checagem de frescor |
| `deck.json` | **Precache com revisão de conteúdo** | C-11: uma nova versão de deck implica novo build; sem isso o Cache First serviria a v1 para sempre (MIG-01) |
| Ícones e manifest | **Precache** | Instalabilidade não pode depender de rede |
| Nada mais | — | A aplicação não faz nenhuma outra requisição: sem fontes remotas, sem analytics, sem CDN |

## Atualização

`vite-plugin-pwa` em modo `prompt`: o SW novo instala em segundo plano e só assume
quando todas as abas antigas fecham ou o usuário aceita. Evita trocar o código sob
uma sessão de revisão em curso.

**Precache é tudo-ou-nada:** se qualquer ativo do manifesto falhar, a instalação
falha e o SW não ativa. Não existe estado persistente "instalado com cache parcial"
(resolve RES-01).

## Sinais emitidos para a aplicação (OBS-02, IMP-06)

Mecanismo concreto: o módulo `service-worker` registra via `registerSW` do
`vite-plugin-pwa`, cujos callbacks são alimentados pelo ciclo de vida do próprio
service worker (`workbox-window` por baixo).

- `onOfflineReady` — o precache concluiu; a interface passa a exibir
  "pronto para uso sem rede" na linha de estado.
- `onNeedRefresh` — há versão nova instalada esperando (`registerType: 'prompt'`),
  então a troca nunca acontece por baixo de uma sessão em curso.
- `onRegisterError` — o registro falhou (ex.: fora de contexto seguro).

## Verificação mecânica (C-17)

A sincronia entre este documento e `vite.config.ts` é checada por teste na Fase 6:
o manifesto gerado em `dist/sw.js` deve conter `index.html`, `deck.json` e os dois
ícones. Documento normativo que só depende de disciplina foi o achado GOV-04.

Estado verificado no build atual: 10 entradas de precache, `deck.json` presente
com revisão de conteúdo — que é o que impede MIG-01 (servir para sempre a v1 do
baralho e nunca disparar a migração).

## Campos obrigatórios do manifest (REG-03)

`name`, `short_name`, `start_url`, `display: 'standalone'`, `background_color`,
`theme_color`, e `icons` com 192×192 e 512×512 PNG.
