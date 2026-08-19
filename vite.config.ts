import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Estratégia de cache declarada por escrito em specs/technical/cache-strategy.md
 * (contrato C-13; exigência literal de REQUISITOS.md §6 Inc.2).
 *
 * C-11 / MIG-01: `deck.json` PRECISA entrar no manifesto de precache. O padrão do
 * Workbox cobre js/css/html/ico/png/svg e deixaria o JSON de fora — e aí uma
 * estratégia Cache First serviria a v1 do baralho para sempre, fazendo a migração
 * do Inc.2 nunca disparar e falhar em silêncio.
 */
export default defineConfig({
  build: { target: 'es2022' },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Revisão de chinês',
        short_name: '中',
        description: 'Repetição espaçada de vocabulário chinês, offline',
        start_url: '/',
        display: 'standalone',
        background_color: '#14161a',
        theme_color: '#14161a',
        lang: 'pt-BR',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
})
