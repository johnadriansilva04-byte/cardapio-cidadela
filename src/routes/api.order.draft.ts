import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getServerSupabase } from "@/api/lib/mercadopago";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/api/lib/rate-limit";
import { runAi, isAiEnabled } from "@/api/lib/ai";
import {
  buildOrderPrompt,
  parseAiOrder,
  parseOrderDeterministic,
  reconcileOrderDraft,
  type MenuAddon,
  type MenuProduct,
} from "@/api/lib/order-draft";

/**
 * POST /api/order/draft
 *
 * O Pracinha monta o carrinho do CLIENTE a partir do texto livre ("quero 2
 * x-burger sem cebola e um guaraná"). Devolve as linhas prontas para o carrinho
 * do cardápio público + uma resposta curta para mostrar na conversa.
 *
 * SEGURANÇA: a IA só mapeia texto → produto/aditivo. Ela NÃO devolve preço, e o
 * que devolve é validado contra o catálogo real antes de sair. Quem calcula o
 * valor é a RPC `create_order_atomic` no servidor — o mesmo caminho de sempre.
 * Então nada aqui pode alterar quanto o cliente paga.
 *
 * É pública de propósito (o cliente do cardápio é anônimo). Tem rate-limit por
 * IP e o catálogo é limitado ao restaurante pedido. Sem `CLOUDFLARE_AI_TOKEN` o
 * parser determinístico por nome ainda monta o pedido.
 *
 * Body: { restaurantId, text }
 */

interface DraftBody {
  restaurantId?: string;
  text?: string;
}

export const Route = createFileRoute("/api/order/draft")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = checkRateLimit(`order-draft:${getClientIp(request)}`, 20, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        let body: DraftBody = {};
        try {
          body = (await request.json()) as DraftBody;
        } catch {
          return json({ error: "corpo inválido" }, 400);
        }
        const restaurantId = (body.restaurantId ?? "").trim();
        const text = (body.text ?? "").trim().slice(0, 500);
        if (!restaurantId) return json({ error: "restaurantId não fornecido" }, 400);
        if (!text) return json({ error: "texto vazio" }, 400);

        const supabase = getServerSupabase();
        if (!supabase) return json({ error: "supabase não configurado" }, 500);

        const [{ data: productRows }, { data: addonRows }] = await Promise.all([
          supabase
            .from("products")
            .select("id, name, category_id")
            .eq("restaurant_id", restaurantId)
            .eq("available", true),
          supabase
            .from("product_addons")
            .select("id, name, product_id")
            .eq("restaurant_id", restaurantId)
            .eq("available", true),
        ]);

        const products = (productRows ?? []) as MenuProduct[];
        const addons = (addonRows ?? []) as MenuAddon[];
        if (products.length === 0) {
          return json({ lines: [], unmatched: [], ai: false, reply: "" }, 200);
        }

        const fallback = parseOrderDeterministic(text, products, addons);

        let draft = fallback;
        if (isAiEnabled()) {
          const raw = await runAi(
            [buildOrderPrompt(products, addons), { role: "user", content: text }],
            undefined,
            500,
          );
          if (raw) {
            draft = reconcileOrderDraft(parseAiOrder(raw), fallback, products, addons);
          }
        }

        const byId = new Map(products.map((p) => [p.id, p.name]));
        const addonName = new Map(addons.map((a) => [a.id, a.name]));
        const lines = draft.lines.map((l) => ({
          product_id: l.product_id,
          name: byId.get(l.product_id) ?? "",
          quantity: l.quantity,
          addon_ids: l.addon_ids,
          addon_names: l.addon_ids.map((id) => addonName.get(id) ?? "").filter(Boolean),
          notes: l.notes,
        }));

        return json(
          {
            lines,
            unmatched: draft.unmatched,
            ai: draft.ai,
            reply: buildReply(lines, draft.unmatched),
          },
          200,
        );
      },
    },
  },
});

function buildReply(
  lines: { name: string; quantity: number; addon_names: string[]; notes: string }[],
  unmatched: string[],
): string {
  if (lines.length === 0) {
    return "Não encontrei esses itens no cardápio. Pode escrever de outro jeito ou tocar nos itens?";
  }
  const parts = lines.map((l) => {
    const extras = [
      l.addon_names.length ? `com ${l.addon_names.join(", ")}` : "",
      l.notes ? `(${l.notes})` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `${l.quantity}× ${l.name}${extras ? ` ${extras}` : ""}`;
  });
  let reply = `Anotei: ${parts.join(", ")}.`;
  if (unmatched.length > 0) {
    reply += ` Não achei "${unmatched.join(", ")}" no cardápio — quer escolher na mão?`;
  }
  return reply;
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
