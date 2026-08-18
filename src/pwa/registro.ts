/** Caminho do service worker emitido pelo build, na raiz para valer para todo o escopo. */
export const CAMINHO_SW = '/sw.js';

/**
 * Registra o service worker.
 *
 * Falha de registro não derruba a aplicação: sem service worker ela continua
 * funcionando, apenas sem partida a frio offline. Devolve `null` nesse caso.
 */
export async function registrarServiceWorker(
  caminho: string = CAMINHO_SW,
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(caminho, { scope: '/' });
  } catch (erro) {
    console.warn('service worker não registrado:', erro);
    return null;
  }
}
