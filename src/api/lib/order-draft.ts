import { extractJson } from "@/api/lib/ai";
import type { ChatMessage } from "@/api/lib/ai";
import type { MenuAddon, MenuProduct, OrderDraftLine } from "@/lib/order-draft";

/**
 * Parte SERVER-ONLY do "garçom digital": o prompt e a leitura da resposta da IA.
 *
 * O parser determinístico e a validação contra o catálogo vivem em
 * `@/lib/order-draft` (client-safe), porque o mesmo código roda no navegador
 * como fallback offline. Aqui fica só o que depende do Workers AI.
 *
 * REGRA DE OURO: a IA NUNCA define preço. Ela só devolve `product_id`,
 * `quantity`, `addon_ids` e `notes` — o preço continua sendo recalculado no
 * servidor pela RPC `create_order_atomic`.
 */

export type { MenuAddon, MenuProduct, OrderDraftLine } from "@/lib/order-draft";
export { matchProduct, parseOrderDeterministic, reconcileOrderDraft } from "@/lib/order-draft";

export function buildOrderPrompt(products: MenuProduct[], addons: MenuAddon[]): ChatMessage {
  const catalog = products.map((p) => `- ${p.id} = ${p.name}`).join("\n");
  const addonList = addons.map((a) => `- ${a.id} = ${a.name}`).join("\n");
  return {
    role: "system",
    content: `Você monta o carrinho de um cardápio a partir do que o cliente escreveu.
Responda SÓ com JSON, no formato {"lines":[{"product_id":"...","quantity":1,"addon_ids":[],"notes":""}]}.

PRODUTOS (use EXATAMENTE este id):
${catalog}

ADICIONAIS (use EXATAMENTE este id; só os que existem):
${addonList || "(nenhum)"}

REGRAS
- Use apenas ids das listas acima. Nunca invente id, produto ou preço.
- "quantity" é um número inteiro de 1 a 50.
- "addon_ids" só para adicionais citados que existam na lista.
- "notes" para pedidos como "sem cebola", "bem passado" (máx. 100 caracteres).
- Se não reconhecer algo, ignore. Não invente.`,
  };
}

/** Extrai `{lines:[...]}` de uma resposta de IA. */
export function parseAiOrder(text: string): OrderDraftLine[] {
  const parsed = extractJson<{ lines?: unknown }>(text);
  if (!parsed || !Array.isArray(parsed.lines)) return [];
  return parsed.lines
    .filter((l): l is Record<string, unknown> => Boolean(l) && typeof l === "object")
    .map((l) => ({
      product_id: String(l.product_id ?? ""),
      quantity: Number(l.quantity ?? 1),
      addon_ids: Array.isArray(l.addon_ids) ? l.addon_ids.map(String) : [],
      notes: typeof l.notes === "string" ? l.notes : "",
    }))
    .filter((l) => l.product_id);
}
