import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getServerSupabase } from "@/api/lib/mercadopago";
import { syncSubscriptionForEmail } from "@/api/lib/mp-subscription";

/**
 * POST /api/subscription/sync
 *
 * Fallback manual do webhook: o dono clica em "Sincronizar" e buscamos o
 * preapproval direto na API do Mercado Pago pelo e-mail da conta autenticada.
 *
 * Exige um token de sessão válido (Authorization: Bearer <access_token>). O
 * `storeId` é validado contra o e-mail registrado na linha, de modo que um token
 * de uma conta não ativa o Premium de outra.
 */
export const Route = createFileRoute("/api/subscription/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) {
          return json({ error: "missing token" }, 401);
        }

        const supabase = getServerSupabase();
        if (!supabase) return json({ error: "supabase não configurado" }, 500);

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        const email = userData?.user?.email ?? "";
        if (userError || !email) {
          return json({ error: "invalid token" }, 401);
        }

        let body: { storeId?: string } = {};
        try {
          body = (await request.json()) as { storeId?: string };
        } catch {
          body = {};
        }
        const storeId = String(body.storeId ?? "");
        if (!storeId) return json({ error: "missing storeId" }, 400);

        try {
          const result = await syncSubscriptionForEmail(supabase, storeId, email);
          if (result.status === "forbidden") {
            return json({ error: "email não confere com a conta" }, 403);
          }
          return json({ status: result.status, preapprovalId: result.preapprovalId }, 200);
        } catch (e) {
          console.error("[subscription/sync]", e);
          return json({ error: "sync failed" }, 500);
        }
      },
    },
  },
});

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
