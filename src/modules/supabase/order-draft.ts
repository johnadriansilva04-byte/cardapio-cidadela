/**
 * Chama o Pracinha para montar o carrinho a partir de texto livre.
 *
 * Devolve as linhas já validadas no servidor (produto/aditivo existentes) — o
 * preço não vem daqui, é calculado no checkout. `null` em falha: a UI mantém o
 * carrinho como está e o cliente segue tocando nos itens.
 */

export interface DraftLine {
  product_id: string;
  name: string;
  quantity: number;
  addon_ids: string[];
  addon_names: string[];
  notes: string;
}

export interface OrderDraft {
  lines: DraftLine[];
  unmatched: string[];
  ai: boolean;
  reply: string;
}

export async function draftOrder(restaurantId: string, text: string): Promise<OrderDraft | null> {
  if (!restaurantId || !text.trim()) return null;
  try {
    const res = await fetch("/api/order/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, text: text.slice(0, 500) }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as OrderDraft | null;
    if (!data || !Array.isArray(data.lines)) return null;
    return data;
  } catch {
    return null;
  }
}
