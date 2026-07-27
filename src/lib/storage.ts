import { DEFAULT_STATE, type AppState } from "./types";

const DB_NAME = "CardapioDB";
const STORE = "kv";
const STATE_KEY = "currentState";
const LS_KEY = "cardapio_state_backup";

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveToIndexedDB(key: string, value: unknown): Promise<void> {
  try {
    localStorage.setItem(`${LS_KEY}:${key}`, JSON.stringify(value));
  } catch {
    /* quota/private mode */
  }
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function loadFromIndexedDB<T>(key: string): Promise<T | null> {
  const db = await openDB();
  if (db) {
    const fromIdb = await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
    if (fromIdb) return fromIdb;
  }
  try {
    const raw = localStorage.getItem(`${LS_KEY}:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Merge persisted state onto defaults so new fields never break old installs. */
export function mergeState(persisted: Partial<AppState> | null): AppState {
  if (!persisted) return DEFAULT_STATE;
  return {
    ...DEFAULT_STATE,
    ...persisted,
    store: { ...DEFAULT_STATE.store, ...persisted.store },
    payment: { ...DEFAULT_STATE.payment, ...persisted.payment },
    promo: { ...DEFAULT_STATE.promo, ...persisted.promo },
    admin: { ...DEFAULT_STATE.admin, ...persisted.admin },
    integrations: { ...DEFAULT_STATE.integrations, ...persisted.integrations },
    cidadela: { ...DEFAULT_STATE.cidadela, ...persisted.cidadela },
    categories: persisted.categories?.length ? persisted.categories : DEFAULT_STATE.categories,
  };
}

export const STATE_STORAGE_KEY = STATE_KEY;
