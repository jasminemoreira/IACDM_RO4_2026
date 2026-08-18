#!/usr/bin/env node
/**
 * Endpoint JSON que serve de armazenamento remoto para a sincronização.
 *
 * É deliberadamente burro: guarda um conjunto de revisões indexado por `id` e
 * não resolve conflito nenhum. Toda a reconciliação — união, ordem total e a
 * dobra do SM-2 — está no cliente, em `src/sync/`. O servidor só precisa não
 * perder fatos e não duplicá-los.
 *
 *   GET  /sync  ->  { "revisoes": [...] }
 *   POST /sync  <-  { "revisoes": [...] }   ->  { "revisoes": [<união>] }
 *   DELETE /sync                            ->  esvazia (só para reiniciar cenários)
 *
 * Uso: node servidor/remoto.mjs [--porta 5179] [--arquivo estado.json]
 */

import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';

const argumentos = process.argv.slice(2);
const opcao = (nome, padrao) => {
  const i = argumentos.indexOf(`--${nome}`);
  return i >= 0 && argumentos[i + 1] !== undefined ? argumentos[i + 1] : padrao;
};

const PORTA = Number(opcao('porta', '5179'));
const ARQUIVO = opcao('arquivo', null);
const LIMITE_CORPO = 4 * 1024 * 1024;

/** id da revisão -> revisão. */
const revisoes = new Map();

if (ARQUIVO !== null) {
  try {
    for (const r of JSON.parse(readFileSync(ARQUIVO, 'utf8')).revisoes ?? []) {
      revisoes.set(r.id, r);
    }
    console.log(`remoto: ${revisoes.size} revisões carregadas de ${ARQUIVO}`);
  } catch {
    console.log(`remoto: começando vazio (${ARQUIVO} ainda não existe)`);
  }
}

function persistir() {
  if (ARQUIVO === null) return;
  writeFileSync(ARQUIVO, JSON.stringify({ revisoes: [...revisoes.values()] }, null, 2));
}

/** Valida o mínimo: sem isso um cliente quebrado envenenaria os outros. */
function ehRevisao(r) {
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.id === 'string' &&
    r.id !== '' &&
    typeof r.dispositivo === 'string' &&
    typeof r.cartaoId === 'string' &&
    Number.isInteger(r.q) &&
    r.q >= 0 &&
    r.q <= 5 &&
    Number.isFinite(r.em)
  );
}

function responderJson(res, status, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(texto),
  });
  res.end(texto);
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let bruto = '';
    req.on('data', (pedaco) => {
      bruto += pedaco;
      if (bruto.length > LIMITE_CORPO) {
        reject(new Error('corpo grande demais'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(bruto));
    req.on('error', reject);
  });
}

const servidor = createServer(async (req, res) => {
  const caminho = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname;

  if (req.method === 'OPTIONS') return responderJson(res, 204, {});
  if (caminho !== '/sync') return responderJson(res, 404, { erro: 'use /sync' });

  if (req.method === 'GET') {
    return responderJson(res, 200, { revisoes: [...revisoes.values()] });
  }

  if (req.method === 'DELETE') {
    revisoes.clear();
    persistir();
    return responderJson(res, 200, { revisoes: [] });
  }

  if (req.method === 'POST') {
    let corpo;
    try {
      corpo = JSON.parse(await lerCorpo(req));
    } catch (erro) {
      return responderJson(res, 400, { erro: `corpo inválido: ${erro.message}` });
    }

    const recebidas = corpo?.revisoes;
    if (!Array.isArray(recebidas)) {
      return responderJson(res, 400, { erro: 'esperado { "revisoes": [...] }' });
    }
    if (!recebidas.every(ehRevisao)) {
      return responderJson(res, 400, { erro: 'alguma revisão está malformada' });
    }

    // união: quem já está guardado não é sobrescrito, e nada é removido
    let novas = 0;
    for (const revisao of recebidas) {
      if (!revisoes.has(revisao.id)) {
        revisoes.set(revisao.id, revisao);
        novas += 1;
      }
    }
    if (novas > 0) persistir();
    console.log(`remoto: +${novas} revisões (total ${revisoes.size})`);

    return responderJson(res, 200, { revisoes: [...revisoes.values()] });
  }

  return responderJson(res, 405, { erro: `método ${req.method} não suportado` });
});

servidor.listen(PORTA, () => {
  console.log(`remoto ouvindo em http://localhost:${PORTA}/sync`);
});
