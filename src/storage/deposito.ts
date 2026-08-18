/**
 * Depósito local de chave-valor.
 *
 * A implementação de produção é IndexedDB; a de memória serve aos testes e ao
 * navegador que negue armazenamento (janela privada, quota esgotada), caso em
 * que a aplicação segue funcionando sem persistir.
 */
export interface Deposito {
  readonly persistente: boolean;
  ler(chave: string): Promise<unknown | null>;
  escrever(chave: string, valor: unknown): Promise<void>;
}

const BANCO = 'hanzi';
const LOJA = 'estado';
const VERSAO_BANCO = 1;

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, VERSAO_BANCO);
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(LOJA)) {
        pedido.result.createObjectStore(LOJA);
      }
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error ?? new Error('falha ao abrir IndexedDB'));
    pedido.onblocked = () => reject(new Error('IndexedDB bloqueado por outra aba'));
  });
}

function transacionar<T>(
  banco: IDBDatabase,
  modo: IDBTransactionMode,
  operacao: (loja: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction(LOJA, modo);
    const pedido = operacao(transacao.objectStore(LOJA));
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error ?? new Error('falha na transação'));
    transacao.onabort = () => reject(transacao.error ?? new Error('transação abortada'));
  });
}

export function depositoIndexedDb(): Deposito {
  let banco: Promise<IDBDatabase> | null = null;
  const conectar = (): Promise<IDBDatabase> => (banco ??= abrirBanco());

  return {
    persistente: true,
    async ler(chave) {
      const db = await conectar();
      return (await transacionar<unknown>(db, 'readonly', (loja) => loja.get(chave))) ?? null;
    },
    async escrever(chave, valor) {
      const db = await conectar();
      await transacionar(db, 'readwrite', (loja) => loja.put(valor, chave));
    },
  };
}

export function depositoMemoria(inicial?: ReadonlyMap<string, unknown>): Deposito {
  const dados = new Map<string, unknown>(inicial);
  return {
    persistente: false,
    ler: (chave) => Promise.resolve(dados.get(chave) ?? null),
    escrever: (chave, valor) => {
      dados.set(chave, structuredClone(valor));
      return Promise.resolve();
    },
  };
}

/** IndexedDB quando disponível; memória como último recurso. */
export function depositoPadrao(): Deposito {
  if (typeof indexedDB === 'undefined') return depositoMemoria();
  try {
    return depositoIndexedDb();
  } catch {
    return depositoMemoria();
  }
}
