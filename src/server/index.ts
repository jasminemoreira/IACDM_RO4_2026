/**
 * server — só HTTP.
 *
 * Incremento 1: serve o app estático em localhost, o que é o que dá ao service worker
 * do Incremento 2 o contexto seguro de que ele precisa. As rotas /events chegam no
 * Incremento 3, junto com `event-store`.
 *
 * SEC-01: bind em 127.0.0.1 — o endpoint não escuta na rede.
 * SEC-02: estáticos por ALLOWLIST do manifesto de build; nenhum caminho da requisição
 * é concatenado a caminho de disco, então travessia de diretório não tem por onde entrar.
 * REG-05: tipos MIME declarados, `manifest.webmanifest` inclusive.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const TIPOS: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

export function tipoDe(caminho: string): string {
  const ponto = caminho.lastIndexOf(".");
  return (ponto >= 0 ? TIPOS[caminho.slice(ponto)] : undefined) ?? "application/octet-stream";
}

export type OpcoesServidor = {
  readonly raiz: string;
  readonly porta?: number;
};

export async function carregarAllowlist(raiz: string): Promise<Set<string>> {
  const bruto = await readFile(join(raiz, "precache-manifest.json"), "utf8");
  const { arquivos } = JSON.parse(bruto) as { arquivos: string[] };
  return new Set(arquivos.map((a) => a.replace(/^\.\//, "/")));
}

export async function criarServidor(opcoes: OpcoesServidor) {
  const allowlist = await carregarAllowlist(opcoes.raiz);

  const servidor = createServer((req: IncomingMessage, res: ServerResponse) => {
    void atender(req, res).catch(() => {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("erro interno");
    });
  });

  async function atender(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const pedido = url.pathname === "/" ? "/index.html" : url.pathname;

    if (!allowlist.has(pedido)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("não encontrado");
      return;
    }
    // O caminho de disco vem do MANIFESTO, não da requisição.
    const conteudo = await readFile(join(opcoes.raiz, pedido.slice(1)));
    res.writeHead(200, { "content-type": tipoDe(pedido), "cache-control": "no-cache" });
    res.end(conteudo);
  }

  return {
    servidor,
    allowlist,
    escutar(): Promise<number> {
      return new Promise((resolve) => {
        servidor.listen(opcoes.porta ?? 8787, "127.0.0.1", () => {
          const addr = servidor.address();
          resolve(typeof addr === "object" && addr !== null ? addr.port : 0);
        });
      });
    },
    fechar(): Promise<void> {
      return new Promise((resolve) => servidor.close(() => resolve()));
    },
  };
}
