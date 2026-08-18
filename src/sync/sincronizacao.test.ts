import { describe, expect, it } from 'vitest';
import { carregarDeck } from '../deck/index.js';
import type { Nota } from '../scheduler/index.js';
import {
  ErroRemoto,
  novaRevisao,
  projetar,
  remotoHttp,
  remotoMemoria,
  sincronizar,
  unir,
} from './index.js';
import type { Remoto, Revisao } from './index.js';

const T0 = Date.UTC(2026, 0, 1);
const deck = carregarDeck('exemplo').cartoes;

/**
 * Um dispositivo: mantém seu próprio log e registra revisões nele,
 * exatamente como a aplicação faz.
 */
function dispositivo(nome: string) {
  let log: readonly Revisao[] = [];
  return {
    get log() {
      return log;
    },
    revisar(cartaoId: string, q: Nota, em: number): void {
      log = [...log, novaRevisao(log, nome, cartaoId, q, em)];
    },
    async sincronizar(remoto: Remoto, em = T0 + 1000) {
      const resultado = await sincronizar(remoto, log, em);
      log = resultado.log;
      return resultado;
    },
    get progresso() {
      return projetar([], log, deck);
    },
  };
}

describe('cenário: dois dispositivos revisam os mesmos cartões offline', () => {
  /**
   * O cenário reproduzível do brief.
   *
   * A e B partem do mesmo ponto (nada revisado). Offline, os dois revisam
   * `c001` e `c002`, com notas diferentes e em instantes diferentes. Depois
   * sincronizam com o mesmo remoto: A, depois B, depois A de novo.
   *
   * A terceira sincronização não é detalhe: quem sincroniza primeiro só fica
   * sabendo do outro na vez seguinte. Convergência aqui significa "cada
   * dispositivo converge assim que sincroniza depois do outro ter empurrado".
   */
  async function cenario() {
    const remoto = remotoMemoria();
    const a = dispositivo('a');
    const b = dispositivo('b');

    // A, offline
    a.revisar('c001', 5, T0 + 10);
    a.revisar('c002', 4, T0 + 20);
    a.revisar('c003', 3, T0 + 30);

    // B, offline, sobre os mesmos cartões c001 e c002
    b.revisar('c001', 2, T0 + 15);
    b.revisar('c002', 5, T0 + 25);

    // A volta à rede primeiro, B depois, e A sincroniza de novo
    const syncA = await a.sincronizar(remoto, T0 + 100);
    const syncB = await b.sincronizar(remoto, T0 + 200);
    const syncA2 = await a.sincronizar(remoto, T0 + 300);

    return { remoto, a, b, syncA, syncB, syncA2 };
  }

  it('nenhum dos dois lados perde revisões já registradas', async () => {
    const { a, b } = await cenario();

    const ids = a.log.map((r) => r.id).sort();
    expect(ids).toEqual(['a-1', 'a-2', 'a-3', 'b-1', 'b-2']);
    expect(b.log.map((r) => r.id).sort()).toEqual(ids);
  });

  it('os dois dispositivos convergem para o mesmo log e o mesmo progresso', async () => {
    const { a, b } = await cenario();

    expect(a.log).toEqual(b.log);
    expect(a.progresso).toEqual(b.progresso);
  });

  it('a resolução aplica as revisões concorrentes na ordem dos instantes', async () => {
    const { a } = await cenario();

    // c001: A deu 5 em T0+10, B deu 2 em T0+15 — as duas contam, nessa ordem
    expect(a.log.filter((r) => r.cartaoId === 'c001').map((r) => [r.id, r.q])).toEqual([
      ['a-1', 5],
      ['b-1', 2],
    ]);

    // a nota 2 é erro: zera n e devolve o intervalo a 1 dia
    const c001 = a.progresso.get('c001');
    expect(c001?.n).toBe(0);
    expect(c001?.intervaloDias).toBe(1);
    expect(c001?.ef).toBeCloseTo(2.5 + 0.1 - 0.32, 10);
  });

  it('o relatório de cada lado diz o que se moveu', async () => {
    const { syncA, syncB, syncA2 } = await cenario();

    expect(syncA).toMatchObject({ recebidas: 0, enviadas: 3 });
    expect(syncB).toMatchObject({ recebidas: 3, enviadas: 2 });
    expect(syncA2).toMatchObject({ recebidas: 2, enviadas: 0 });
  });

  it('o remoto termina com tudo', async () => {
    const { remoto } = await cenario();
    expect((await remoto.puxar()).map((r) => r.id).sort()).toEqual([
      'a-1',
      'a-2',
      'a-3',
      'b-1',
      'b-2',
    ]);
  });

  it('a ordem em que os dispositivos sincronizam não muda o resultado', async () => {
    const remoto = remotoMemoria();
    const a = dispositivo('a');
    const b = dispositivo('b');
    a.revisar('c001', 5, T0 + 10);
    a.revisar('c002', 4, T0 + 20);
    a.revisar('c003', 3, T0 + 30);
    b.revisar('c001', 2, T0 + 15);
    b.revisar('c002', 5, T0 + 25);

    // desta vez B primeiro
    await b.sincronizar(remoto, T0 + 100);
    await a.sincronizar(remoto, T0 + 200);
    await b.sincronizar(remoto, T0 + 300);
    expect(a.log).toEqual(b.log);

    const esperado = await cenario();
    expect(a.progresso).toEqual(esperado.a.progresso);
    expect(a.log).toEqual(esperado.a.log);
  });

  it('sincronizar de novo, sem revisões novas, não muda nada', async () => {
    const { a, b, remoto } = await cenario();
    const antes = a.log;

    const denovo = await a.sincronizar(remoto, T0 + 400);

    expect(denovo).toMatchObject({ recebidas: 0, enviadas: 0 });
    expect(a.log).toEqual(antes);
    expect(a.log).toEqual(b.log);
  });

  it('revisões feitas depois da sincronização continuam convergindo', async () => {
    const { a, b, remoto } = await cenario();

    a.revisar('c004', 5, T0 + 400);
    b.revisar('c004', 0, T0 + 410);
    await a.sincronizar(remoto, T0 + 500);
    await b.sincronizar(remoto, T0 + 600);
    await a.sincronizar(remoto, T0 + 700);

    expect(a.log).toEqual(b.log);
    expect(a.log.filter((r) => r.cartaoId === 'c004')).toHaveLength(2);
    expect(a.progresso).toEqual(b.progresso);
  });

  it('um cartão que só um dos lados revisou não é afetado', async () => {
    const { a, b } = await cenario();

    // c003 só A revisou, com nota 3
    expect(a.progresso.get('c003')?.n).toBe(1);
    expect(a.progresso.get('c003')).toEqual(b.progresso.get('c003'));
  });
});

describe('sincronizar', () => {
  it('não escreve no remoto quando não há nada a enviar', async () => {
    let escritas = 0;
    const base = remotoMemoria([
      { id: 'a-1', dispositivo: 'a', cartaoId: 'c001', q: 5, em: T0 },
    ]);
    const remoto: Remoto = {
      descricao: 'espião',
      puxar: () => base.puxar(),
      empurrar: (log) => {
        escritas += 1;
        return base.empurrar(log);
      },
    };

    const resultado = await sincronizar(remoto, [], T0 + 1);

    expect(escritas).toBe(0);
    expect(resultado).toMatchObject({ recebidas: 1, enviadas: 0 });
  });

  it('incorpora o que um terceiro dispositivo escreveu entre o puxar e o empurrar', async () => {
    const doTerceiro: Revisao = { id: 'c-1', dispositivo: 'c', cartaoId: 'c005', q: 4, em: T0 + 5 };
    const base = remotoMemoria();
    const remoto: Remoto = {
      descricao: 'concorrente',
      puxar: () => base.puxar(),
      empurrar: async (log) => unir(await base.empurrar(log), [doTerceiro]),
    };

    const meu: Revisao = { id: 'a-1', dispositivo: 'a', cartaoId: 'c001', q: 5, em: T0 };
    const resultado = await sincronizar(remoto, [meu], T0 + 10);

    expect(resultado.log.map((r) => r.id)).toEqual(['a-1', 'c-1']);
  });

  it('propaga a falha do remoto sem tocar no log local', async () => {
    const quebrado: Remoto = {
      descricao: 'quebrado',
      puxar: () => Promise.reject(new ErroRemoto('sem rede')),
      empurrar: () => Promise.reject(new ErroRemoto('sem rede')),
    };

    await expect(sincronizar(quebrado, [], T0)).rejects.toThrow(ErroRemoto);
  });
});

describe('remotoHttp', () => {
  const revisao: Revisao = { id: 'a-1', dispositivo: 'a', cartaoId: 'c001', q: 5, em: T0 };
  const resposta = (corpo: unknown, status = 200): Response =>
    new Response(JSON.stringify(corpo), { status });

  it('puxa revisões de um endpoint JSON', async () => {
    const remoto = remotoHttp('/sync', () => Promise.resolve(resposta({ revisoes: [revisao] })));
    expect(await remoto.puxar()).toEqual([revisao]);
  });

  it('empurra o log como JSON e lê a união devolvida', async () => {
    let enviado: string | undefined;
    const remoto = remotoHttp('/sync', (_url, init) => {
      enviado = init?.body as string;
      return Promise.resolve(resposta({ revisoes: [revisao] }));
    });

    expect(await remoto.empurrar([revisao])).toEqual([revisao]);
    expect(JSON.parse(enviado ?? '{}')).toEqual({ revisoes: [revisao] });
  });

  it('trata resposta de erro como falha do remoto', async () => {
    const remoto = remotoHttp('/sync', () => Promise.resolve(resposta({}, 500)));
    await expect(remoto.puxar()).rejects.toThrow(/respondeu 500/);
  });

  it('trata rede indisponível como falha do remoto', async () => {
    const remoto = remotoHttp('/sync', () => Promise.reject(new TypeError('failed to fetch')));
    await expect(remoto.puxar()).rejects.toThrow(/inacessível/);
  });

  it('recusa corpo que não seja um log válido', async () => {
    const remoto = remotoHttp('/sync', () =>
      Promise.resolve(resposta({ revisoes: [{ id: 'x' }] })),
    );
    await expect(remoto.puxar()).rejects.toThrow(/dispositivo/);
  });

  it('aceita corpo sem a chave revisoes como log vazio', async () => {
    const remoto = remotoHttp('/sync', () => Promise.resolve(resposta({})));
    expect(await remoto.puxar()).toEqual([]);
  });
});
