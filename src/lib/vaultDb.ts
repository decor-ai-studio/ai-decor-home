// Tiny IndexedDB wrapper shared by the client vault and the render cache.
// Keeps large data-URL images out of localStorage (which caps around 5MB).

const DB_NAME = "glowtech.vault";
const DB_VERSION = 1;
export const STORE_CLIENTS = "clients";
export const STORE_DESIGNS = "designs";
export const STORE_CACHE = "renderCache";

let dbPromise: Promise<IDBDatabase> | null = null;

export function isBrowser() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

export function openVault(): Promise<IDBDatabase> {
  if (!isBrowser()) return Promise.reject(new Error("indexeddb unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CLIENTS)) {
          db.createObjectStore(STORE_CLIENTS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_DESIGNS)) {
          const store = db.createObjectStore(STORE_DESIGNS, { keyPath: "id" });
          store.createIndex("clientId", "clientId", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("indexeddb open failed"));
    });
  }
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openVault().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("indexeddb request failed"));
      }),
  );
}

export const idb = {
  get: <T>(store: string, key: IDBValidKey) => run<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>),
  all: <T>(store: string) => run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
  put: <T>(store: string, value: T) => run(store, "readwrite", (s) => s.put(value as never)),
  del: (store: string, key: IDBValidKey) => run(store, "readwrite", (s) => s.delete(key)),
  clear: (store: string) => run(store, "readwrite", (s) => s.clear()),
};

/** Stable, fast, non-cryptographic hash used for cache keys. */
export function hashKey(input: string): string {
  let h1 = 0x9e3779b9;
  let h2 = 0x85ebca6b;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + input.length.toString(36);
}
