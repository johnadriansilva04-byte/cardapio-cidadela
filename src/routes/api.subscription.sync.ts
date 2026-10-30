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
        const authEmail = userData?.user?.email ?? "";
        if (userError || !userData?.user?.id) {
          return json({ error: "invalid token" }, 401);
        }

        // O login é por telefone, então `auth.email` é o pseudo-e-mail interno
        // (`telefone@menufacil.local`) — o Mercado Pago nunca usa esse endereço.
        // Preferimos o e-mail real gravado em `profiles.email`; sem ele, não há
        // como casar o preapproval e o vínculo automático fica indisponível.
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", userData.user.id)
          .maybeSingle();
        const email = ((profileRow?.email as string | null) || authEmail).trim();
        if (!email) {
          return json({ error: "e-mail não cadastrado" }, 400);
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
