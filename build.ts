/**
 * Build. Não é um módulo (§2): é ferramenta. Faz três coisas —
 * copia o casco, copia o deck de entrada, e GERA o manifesto de precache.
 *
 * ARQ-04: a lista de precache é gerada, nunca escrita à mão. Escrita à mão, ela
 * desatualiza silenciosamente a cada módulo novo, e o casco incompleto só falha
 * offline, onde ninguém está olhando.
 * SEC-02: o mesmo manifesto é a ALLOWLIST do servidor de estáticos — nada de
 * concatenar caminho vindo da requisição.
 */
import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const RAIZ = import.meta.dirname;
const DIST = join(RAIZ, "dist");

async function arquivos(dir: string): Promise<string[]> {
  const saida: string[] = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) saida.push(...(await arquivos(caminho)));
    else saida.push(caminho);
  }
  return saida;
}

await mkdir(DIST, { recursive: true });
await cp(join(RAIZ, "src/ui/shell"), DIST, { recursive: true });
await cp(join(RAIZ, "specs/datasets/deck-v1.json"), join(DIST, "deck.json"));

const lista = (await arquivos(DIST))
  .map((f) => "./" + relative(DIST, f).split(sep).join("/"))
  .filter((f) => f !== "./precache-manifest.json")
  .sort();

await writeFile(join(DIST, "precache-manifest.json"), JSON.stringify({ arquivos: lista }, null, 2) + "\n");
console.log(`build: ${lista.length} arquivos no manifesto`);
