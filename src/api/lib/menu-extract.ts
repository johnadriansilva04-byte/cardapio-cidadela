import { runAiVision, extractJson } from "@/api/lib/ai";
import type { ServerEnv } from "@/api/lib/mercadopago";

/**
 * Lê um cardápio a partir de uma FOTO e devolve categorias + produtos.
 *
 * É a função mais cara do app (token de imagem no Workers AI), por isso vive
 * atrás do plano anual — o gate fica na rota, não aqui. A IA devolve JSON; o
 * parser abaixo valida e limpa, e NADA é gravado: a rota só devolve a sugestão,
 * que o dono confere antes de virar cardápio.
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

const SCAN_PROMPT = `Você lê cardápios de restaurante a partir de uma FOTO e extrai os itens.
Devolva SOMENTE um objeto JSON, sem explicação, neste formato:
{"categories":[{"name":"nome da categoria","products":[{"name":"nome do prato","price":12.5,"description":"opcional"}]}]}
Regras:
- Agrupe por categoria quando a foto mostrar seções (ex.: Lanches, Bebidas). Sem seções, use uma única categoria "Cardápio".
- "price" é número em reais (use ponto decimal). Se não houver preço legível, use 0.
- Não invente itens que não estão na foto. Não traduza. Responda em português.
- No máximo 40 itens no total.`;

/** Corta para caber no limite do parser e evita campos absurdos. */
function cleanName(raw: unknown, max = 80): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

/** Preço plausível em reais; 0 quando ausente ou inválido. */
export function normalizePrice(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 9999) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Valida e limpa o JSON do modelo. Pura — testável sem rede.
 *
 * Descarta categoria sem produto e produto sem nome, e limita a 40 itens para
 * não estourar o cardápio do dono com uma leitura ruim.
 */
export function parseMenuScan(raw: unknown): ScannedCategory[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { categories?: unknown }).categories;
  if (!Array.isArray(list)) return [];

  const out: ScannedCategory[] = [];
  let total = 0;
  for (const cat of list) {
    if (total >= 40) break;
    if (!cat || typeof cat !== "object") continue;
    const name = cleanName((cat as { name?: unknown }).name, 60) || "Cardápio";
    const productsRaw = (cat as { products?: unknown }).products;
    if (!Array.isArray(productsRaw)) continue;
    const products: ScannedProduct[] = [];
    for (const p of productsRaw) {
      if (total >= 40) break;
      if (!p || typeof p !== "object") continue;
      const pName = cleanName((p as { name?: unknown }).name);
      if (!pName) continue;
      const description = cleanName((p as { description?: unknown }).description, 200);
      products.push({
        name: pName,
        price: normalizePrice((p as { price?: unknown }).price),
        ...(description ? { description } : {}),
      });
      total++;
    }
    if (products.length > 0) out.push({ name, products });
  }
  return out;
}

/**
 * Roda a visão e devolve as categorias. `null` quando a IA está desligada ou
 * falhou — a UI avisa e o dono segue digitando.
 */
export async function scanMenuImage(
  imageDataUrl: string,
  env?: ServerEnv,
): Promise<ScannedCategory[] | null> {
  const text = await runAiVision(SCAN_PROMPT, imageDataUrl, env, 1500);
  if (!text) return null;
  const json = extractJson<unknown>(text);
  if (!json) return null;
  const categories = parseMenuScan(json);
  return categories.length > 0 ? categories : null;
}
