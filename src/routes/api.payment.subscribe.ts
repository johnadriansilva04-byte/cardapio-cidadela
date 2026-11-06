import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getServerSupabase, getSupabaseForUser, getMercadoPagoToken } from "@/api/lib/mercadopago";
import { createPreapproval } from "@/api/lib/mp-payment";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/api/lib/rate-limit";
import { SITE_URL } from "@/lib/site";
import { MONTHLY_PRICE_VALUE, PREMIUM_PRICE_VALUE } from "@/lib/pricing";

const FALLBACK_ORIGIN = SITE_URL;

/**
 * POST /api/payment/subscribe
 *
 * Cria uma ASSINATURA RECORRENTE (preapproval) do Mercado Pago e devolve o link
 * de autorização. Diferente do link pontual, o Mercado Pago cobra sozinho a
 * cada ciclo — é o que evita a loja bloquear quando o dono esquece de renovar.
 *
 * Body: { storeId: string, billing?: "monthly" | "annual" }
 * Requer Authorization: Bearer <access_token> e a posse do restaurante.
 *
 * O preço é recalculado AQUI a partir das constantes do servidor — o cliente
 * nunca manda o valor. A ativação só acontece no webhook, quando o Mercado
 * Pago confirma a autorização.
 */
export const Route = createFileRoute("/api/payment/subscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = checkRateLimit(`subscribe:${getClientIp(request)}`, 10, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) {
          return json({ error: "não autenticado" }, 401);
        }

        const mpToken = getMercadoPagoToken();
        if (!mpToken) {
          return json({ error: "Mercado Pago não configurado" }, 500);
        }

        let body: { storeId?: string; billing?: string } = {};
        try {
          body = (await request.json()) as { storeId?: string; billing?: string };
        } catch {
          return json({ error: "invalid body" }, 400);
        }

        const { storeId } = body;
        if (!storeId) {
          return json({ error: "storeId não fornecido" }, 400);
        }

        // Só mensal e anual são assinaturas; qualquer outro valor cai no mensal.
        const billing = body.billing === "annual" ? "annual" : "monthly";

        // Confirma a identidade e a posse do restaurante com o RLS do usuário.
        const userClient = getSupabaseForUser(token);
        if (!userClient) {
          return json({ error: "supabase não configurado" }, 500);
        }
        const { data: authData, error: authError } = await userClient.auth.getUser();
        if (authError || !authData?.user) {
          return json({ error: "token inválido" }, 401);
        }
        const { data: owned } = await userClient
          .from("restaurants")
          .select("id")
          .eq("id", storeId)
          .maybeSingle();
        if (!owned) {
          return json({ error: "restaurante não encontrado para esta conta" }, 403);
        }

        const supabase = getServerSupabase();
        if (!supabase) {
          return json({ error: "supabase não configurado" }, 500);
        }

        // Origem derivada da requisição — back_url e webhook não podem apontar
        // para um domínio fixo que pode nem ser o de produção.
        const requestUrl = new URL(request.url);
        const forwardedHost = request.headers.get("x-forwarded-host");
        const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
        const origin = forwardedHost
          ? `${forwardedProto}://${forwardedHost}`
          : requestUrl.origin || FALLBACK_ORIGIN;
        const backUrl = `${origin}/admin/assinatura`;
        const notificationUrl = `${origin}/api/webhook/mercadopago`;

        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("name")
          .eq("id", storeId)
          .maybeSingle();
        const restaurantName = (restaurant?.name as string) || "Cardápio Cidadela";

        // E-mail real do pagador (o pseudo interno do login não serve): o
        // Mercado Pago casa a cobrança recorrente por ele.
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", authData.user.id)
          .maybeSingle();
        const payerEmail = ((profileRow?.email as string | null) || "").trim();
        const realEmail = payerEmail && !payerEmail.includes("@menufacil.local") ? payerEmail : "";

        // O Mercado Pago EXIGE `payer_email` para criar uma assinatura
        // recorrente (preapproval). O login é por telefone, então sem um e-mail
        // real cadastrado a API devolve 400 — devolvemos um código claro para a
        // UI pedir o e-mail em vez de estourar um 500 opaco.
        if (!realEmail) {
          return json({ error: "payer_email_required" }, 400);
        }

        const annual = billing === "annual";
        const result = await createPreapproval({
          reason: `Cardápio Cidadela Premium (${annual ? "anual" : "mensal"}) - ${restaurantName}`,
          externalReference: storeId,
          unitPrice: annual ? PREMIUM_PRICE_VALUE : MONTHLY_PRICE_VALUE,
          payerEmail: realEmail,
          backUrl,
          notificationUrl,
          frequencyType: "months",
          frequency: annual ? 12 : 1,
        });

        if (!result) {
          return json({ error: "falha ao criar assinatura" }, 500);
        }

        return json(result, 200);
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
