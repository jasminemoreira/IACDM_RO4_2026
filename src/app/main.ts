/**
 * Ponto de entrada do navegador. É aqui — e só aqui — que os adaptadores concretos
 * são escolhidos. Trocar `criarMemoria` por `criarIndexedDB` é a única mudança que o
 * Incremento 2 precisa fazer neste arquivo.
 */
import { start } from "./index.ts";
import { criarMemoria } from "../storage/index.ts";

const root = document.getElementById("app");
if (!root) throw new Error("elemento #app ausente no casco");

await start({
  repo: criarMemoria(),
  carregarDeck: async () => {
    const resposta = await fetch("./deck.json");
    if (!resposta.ok) throw new Error(`deck.json respondeu ${resposta.status}`);
    return resposta.json();
  },
  agora: () => Date.now(),
  root,
  online: () => navigator.onLine,
});
