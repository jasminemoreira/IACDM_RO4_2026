/// <reference types="vite-plugin-pwa/client" />
/**
 * Módulo M-08 `service-worker` — registro, precache e sinais de estado.
 *
 * C-7: este módulo NÃO lê nem escreve progresso. Sem essa fronteira haveria dois
 * escritores do log — e a garantia de "nenhuma revisão perdida" dependeria de
 * coordenação entre threads.
 *
 * C-11 / RES-01: o precache do Workbox é tudo-ou-nada. Se qualquer ativo do
 * manifesto falhar, a instalação falha e o service worker não ativa — logo não
 * existe estado persistente "instalado com cache parcial", que era a falha sem
 * caminho de recuperação apontada pela lente de resiliência.
 *
 * IMP-06 / OBS-02: os sinais abaixo são o mecanismo concreto pelo qual a aplicação
 * sabe se está pronta para funcionar sem rede e se há versão nova esperando.
 * Sem eles, a falha que quebra a partida a frio offline seria invisível.
 */

import { registerSW } from 'virtual:pwa-register'

export type SwSignals = {
  /** Precache concluído: a aplicação pode afirmar que funciona sem rede. */
  onOfflineReady?: () => void
  /** Há uma versão nova instalada, esperando para assumir (registerType 'prompt'). */
  onNeedRefresh?: (apply: () => Promise<void>) => void
  onRegisterError?: (error: unknown) => void
}

/**
 * Registra o service worker. Devolve `null` quando o registro não é possível —
 * notadamente fora de contexto seguro (A-5: `file://` não registra service worker,
 * verificado em MDN e não presumido).
 */
export function registerServiceWorker(signals: SwSignals = {}): (() => Promise<void>) | null {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null

  let applyUpdate: (reload?: boolean) => Promise<void>

  applyUpdate = registerSW({
    immediate: true,
    onOfflineReady() {
      signals.onOfflineReady?.()
    },
    onNeedRefresh() {
      signals.onNeedRefresh?.(() => applyUpdate(true))
    },
    onRegisterError(error) {
      signals.onRegisterError?.(error)
    },
  })

  return () => applyUpdate(true)
}
