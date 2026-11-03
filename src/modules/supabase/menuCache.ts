// Cache local do cardápio público (SWR).
//
// O cardápio é o dado mais lido do sistema: cada visitante anônimo dispara
// quatro consultas (restaurante, categorias+produtos, bairros, adicionais) e a
// maioria abre o link de novo no mesmo dia. Guardar o último payload no
// dispositivo e servi-lo na hora — revalidando em segundo plano — corta a
// espera e o consumo de egress do Supabase sem nunca mostrar dado velho: se a
// rede devolver algo diferente, a tela troca sozinha.
//
// Fica em `localStorage` (síncrono, então o primeiro paint já tem o cardápio)
// e degrada em silêncio quando o storage está bloqueado ou estourou a cota.

import type {
  Category,
  DeliveryNeighborhood,
  Product,
  ProductAddon,
  Restaurant,
} from "@/lib/types";

export interface PublicMenuSnapshot {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  neighborhoods: DeliveryNeighborhood[];
  addons: ProductAddon[];
  cachedAt: number;
}

/** Versão do formato: muda quando o payload muda de forma. */
const CACHE_VERSION = 1;
const KEY_PREFIX = `cidadela:menu:v${CACHE_VERSION}:`;

/** Idade máxima em que o cache ainda vale como "instantâneo" no primeiro paint. */
export const MENU_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function storageKey(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

function readStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Lê o cardápio guardado para o slug. Devolve `null` quando não há cache, o
 * cache está corrompido ou passou do TTL. Nunca lança.
 */
export function readMenuCache(slug: string): PublicMenuSnapshot | null {
  const storage = readStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicMenuSnapshot;
    if (!parsed || typeof parsed !== "object" || !parsed.restaurant) return null;
    if (typeof parsed.cachedAt !== "number") return null;
    if (Date.now() - parsed.cachedAt > MENU_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Grava o snapshot do cardápio. Se a cota estourar, remove o próprio registro
 * antes de desistir — assim um cardápio grande não bloqueia o cache dos outros.
 */
export function writeMenuCache(slug: string, snapshot: Omit<PublicMenuSnapshot, "cachedAt">): void {
  const storage = readStorage();
  if (!storage) return;
  const key = storageKey(slug);
  const payload = JSON.stringify({ ...snapshot, cachedAt: Date.now() });
  try {
    storage.setItem(key, payload);
  } catch {
    try {
      storage.removeItem(key);
      storage.setItem(key, payload);
    } catch {
      /* storage cheio ou bloqueado — o cardápio simplesmente vem da rede */
    }
  }
}

/** Remove o cache de um slug (usado quando o restaurante deixa de existir). */
export function clearMenuCache(slug: string): void {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(slug));
  } catch {
    /* ignore */
  }
}

/** Idade do snapshot em ms, ou `null` quando não há cache. */
export function menuCacheAge(slug: string): number | null {
  const snapshot = readMenuCache(slug);
  return snapshot ? Date.now() - snapshot.cachedAt : null;
}
