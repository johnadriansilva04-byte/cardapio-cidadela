import {
  buildOrderReply,
  parseOrderDeterministic,
  type MenuAddon,
  type MenuProduct,
  type OrderDraftDisplayLine,
} from "@/lib/order-draft";

/**
 * Chama o Pracinha para montar o carrinho a partir de texto livre.
 *
 * O gate de Premium é do servidor (`/api/order/draft` responde 403 sem Premium).
 * Se a rota não responder (offline, deploy antigo), cai no parser LOCAL com o
 * cardápio já carregado — o "Pedir por texto" continua funcionando sem rede, e
 * o preço segue sendo calculado no checkout.
 *
 * `menu` é o catálogo já em memória no cardápio (o mesmo que a tela mostra).
 */

export type DraftLine = OrderDraftDisplayLine;

export interface OrderDraft {
  lines: DraftLine[];
  unmatched: string[];
  ai: boolean;
  reply: string;
}

export async function draftOrder(
  restaurantId: string,
  text: string,
  menu: { products: MenuProduct[]; addons: MenuAddon[] },
): Promise<OrderDraft | null> {
  if (!restaurantId || !text.trim()) return null;
  try {
    const res = await fetch("/api/order/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, text: text.slice(0, 500) }),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as OrderDraft | null;
      if (data && Array.isArray(data.lines)) return data;
    }
    // 403 (sem Premium) não é caso de fallback: o servidor recusou de propósito.
    if (res.status === 403) return null;
  } catch {
    /* rede caiu — segue para o parser local */
  }
  return localDraft(text, menu);
}

/** Fallback offline: mesmo parser determinístico do servidor, no navegador. */
export function localDraft(
  text: string,
  menu: { products: MenuProduct[]; addons: MenuAddon[] },
): OrderDraft {
  const result = parseOrderDeterministic(text, menu.products, menu.addons);
  const productName = new Map(menu.products.map((p) => [p.id, p.name]));
  const addonName = new Map(menu.addons.map((a) => [a.id, a.name]));
  const lines: DraftLine[] = result.lines.map((l) => ({
    ...l,
    name: productName.get(l.product_id) ?? "",
    addon_names: l.addon_ids.map((id) => addonName.get(id) ?? "").filter(Boolean),
  }));
  return {
    lines,
    unmatched: result.unmatched,
    ai: false,
    reply: buildOrderReply(lines, result.unmatched),
  };
}
