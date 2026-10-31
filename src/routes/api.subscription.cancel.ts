import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getServerSupabase, getSupabaseForUser } from "@/api/lib/mercadopago";
import { cancelPreapproval } from "@/api/lib/mp-payment";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/api/lib/rate-limit";

/**
 * POST /api/subscription/cancel
 *
 * Cancela a assinatura recorrente: primeiro avisa o Mercado Pago (PUT status
 * cancelled) e só então limpa o acesso local. Sem a chamada ao Mercado Pago o
 * cartão continuaria sendo cobrado todo mês mesmo com a loja no plano gratuito.
 *
 * Body: { storeId: string }
 * Requer Authorization: Bearer <access_token> e a posse do restaurante.
 */
export const Route = createFileRoute("/api/subscription/cancel")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = checkRateLimit(`sub-cancel:${getClientIp(request)}`, 10, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) return json({ error: "não autenticado" }, 401);

        const userClient = getSupabaseForUser(token);
        if (!userClient) return json({ error: "supabase não configurado" }, 500);

        const { data: authData, error: authError } = await userClient.auth.getUser();
        if (authError || !authData?.user) return json({ error: "token inválido" }, 401);

        let body: { storeId?: string } = {};
        try {
          body = (await request.json()) as { storeId?: string };
        } catch {
          body = {};
        }
        const storeId = String(body.storeId ?? "");
        if (!storeId) return json({ error: "missing storeId" }, 400);

        // Posse confirmada com o RLS do próprio usuário.
        const { data: owned } = await userClient
          .from("restaurants")
          .select("id")
          .eq("id", storeId)
          .maybeSingle();
        if (!owned) return json({ error: "restaurante não encontrado para esta conta" }, 403);

        const supabase = getServerSupabase();
        if (!supabase) return json({ error: "supabase não configurado" }, 500);

        const { data: row } = await supabase
          .from("admin_trials")
          .select("mercadopago_preapproval_id")
          .eq("store_id", storeId)
          .maybeSingle();
        const preapprovalId = (row?.mercadopago_preapproval_id as string | null) ?? "";

        // Se existe assinatura no Mercado Pago, ela PRECISA ser cancelada lá.
        // Falhar aqui sem avisar seria deixar o dono pagando para sempre.
        if (preapprovalId) {
          const cancelled = await cancelPreapproval(preapprovalId);
          if (!cancelled) {
            return json({ error: "não foi possível cancelar no Mercado Pago" }, 502);
          }
        }

        const { error } = await supabase
          .from("admin_trials")
          .update({
            is_premium: false,
            premium_expires_at: null,
            mercadopago_preapproval_id: null,
          })
          .eq("store_id", storeId);
        if (error) return json({ error: error.message }, 500);

        return json({ cancelled: true, hadPreapproval: Boolean(preapprovalId) }, 200);
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
