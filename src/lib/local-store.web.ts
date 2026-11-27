// Almacenamiento local en web: IndexedDB (aguanta muchos MB, a diferencia de localStorage).
// Misma interfaz que local-store.ts (celular).

const DB_NAME = 'veterinaria-ruth';
const STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export const localStore = {
  async get(key: string): Promise<string | null> {
    try {
      return ((await run('readonly', (s) => s.get(key))) as string | undefined) ?? null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    await run('readwrite', (s) => s.put(value, key));
  },
  async remove(key: string): Promise<void> {
    await run('readwrite', (s) => s.delete(key));
  },
};
