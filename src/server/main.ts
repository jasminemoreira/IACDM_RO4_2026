import { criarServidor } from "./index.ts";
import { join } from "node:path";

const [maior, menor] = process.versions.node.split(".").map(Number) as [number, number];
if (maior < 22 || (maior === 22 && menor < 6)) {
  console.error(`Node ${process.versions.node} não roda TypeScript nativamente. Requer >= 22.6 (MEC-04).`);
  process.exit(1);
}

const raiz = join(import.meta.dirname, "../../dist");
const s = await criarServidor({ raiz, porta: Number(process.env["PORTA"] ?? 8787) });
const porta = await s.escutar();
console.log(`servindo ${raiz} em http://127.0.0.1:${porta}`);
