import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getServerSupabase, getSupabaseForUser } from "@/api/lib/mercadopago";
import { syncSubscriptionForStore } from "@/api/lib/mp-subscription";

/**
 * POST /api/subscription/sync
 *
 * Fallback manual do webhook: o dono clica em "Conferir agora" e buscamos os
 * pagamentos da loja direto na API do Mercado Pago pelo `external_reference`.
 *
 * Exige um token de sessão válido (Authorization: Bearer <access_token>) e
 * confirma a POSSE do restaurante com o RLS do próprio usuário — a busca é pela
 * loja, então sem essa checagem um token qualquer poderia ativar o Premium de
 * outra loja informando o `storeId` dela.
 *
 * Não usamos e-mail: o app autentica por telefone e o e-mail da conta é um
 * pseudo-endereço interno (`<ddd><numero>@menufacil.local`) que o Mercado Pago
 * não conhece — buscar por ele nunca encontrava a assinatura.
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

        // Valida a identidade E a posse da loja com o RLS do usuário.
        const userClient = getSupabaseForUser(token);
        if (!userClient) return json({ error: "supabase não configurado" }, 500);

        const { data: authData, error: authError } = await userClient.auth.getUser();
        if (authError || !authData?.user) {
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

        const { data: owned } = await userClient
          .from("restaurants")
          .select("id")
          .eq("id", storeId)
          .maybeSingle();
        if (!owned) {
          return json({ error: "restaurante não encontrado para esta conta" }, 403);
        }

        const supabase = getServerSupabase();
        if (!supabase) return json({ error: "supabase não configurado" }, 500);

        try {
          const result = await syncSubscriptionForStore(supabase, storeId);
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
