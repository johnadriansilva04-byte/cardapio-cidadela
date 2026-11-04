import { createCategory, createProduct } from "./menu";

/**
 * Leitura de cardápio por FOTO (plano anual) — cliente.
 *
 * A rota `/api/menu/scan` roda a IA de visão e devolve categorias + produtos;
 * aqui está só o envio e a persistência. A IA NUNCA grava: depois de conferir,
 * `importScannedMenu` cria as categorias e os produtos pelo caminho normal.
 *
 * Tudo degrada em silêncio: sem token, sem rota ou sem acesso anual a função
 * devolve um motivo e o dono segue digitando — nada quebra.
 */

export interface ScannedProduct {
  name: string;
  price: number;
  description?: string;
}

export interface ScannedCategory {
  name: string;
  products: ScannedProduct[];
}

export type ScanResult =
  | { ok: true; categories: ScannedCategory[] }
  | { ok: false; reason: "annual_required" | "scan_failed" | "too_large" | "unauthenticated" };

/** Envia a foto (data URL) e devolve as categorias sugeridas. */
export async function scanMenuPhoto(
  storeId: string,
  imageDataUrl: string,
  accessToken: string | undefined,
): Promise<ScanResult> {
  if (!accessToken) return { ok: false, reason: "unauthenticated" };
  try {
    const res = await fetch("/api/menu/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ storeId, image: imageDataUrl }),
    });
    if (res.status === 402) return { ok: false, reason: "annual_required" };
    if (res.status === 413) return { ok: false, reason: "too_large" };
    if (!res.ok) return { ok: false, reason: "scan_failed" };
    const data = (await res.json().catch(() => ({}))) as { categories?: ScannedCategory[] };
    if (!data.categories || data.categories.length === 0) {
      return { ok: false, reason: "scan_failed" };
    }
    return { ok: true, categories: data.categories };
  } catch {
    return { ok: false, reason: "scan_failed" };
  }
}

/**
 * Grava as categorias e produtos lidos. Devolve quantos produtos entraram.
 *
 * Sequencial de propósito: `createCategory` calcula o `sort_order` lendo o
 * maior existente, então criar em paralelo geraria ordens iguais. É uma
 * operação única (o dono acabou de tirar a foto), não vale otimizar.
 */
export async function importScannedMenu(
  restaurantId: string,
  categories: ScannedCategory[],
): Promise<number> {
  let count = 0;
  for (const category of categories) {
    const created = await createCategory(restaurantId, category.name);
    if (!created) continue;
    for (const product of category.products) {
      const row = await createProduct({
        restaurant_id: restaurantId,
        category_id: created.id,
        name: product.name,
        description: product.description ?? "",
        price: product.price,
        image_url: "",
        available: true,
        sort_order: count,
      });
      if (row) count++;
    }
  }
  return count;
}

/** Conta o que a IA achou, para o resumo no chat. */
export function countScanned(categories: ScannedCategory[]): {
  categories: number;
  products: number;
} {
  return {
    categories: categories.length,
    products: categories.reduce((n, c) => n + c.products.length, 0),
  };
}
