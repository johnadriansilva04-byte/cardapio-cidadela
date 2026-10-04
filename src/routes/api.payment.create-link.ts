import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getServerSupabase, getSupabaseForUser, getMercadoPagoToken } from "@/api/lib/mercadopago";
import { createPaymentLink } from "@/api/lib/mp-payment";
import { PREMIUM_PRICE_VALUE } from "@/lib/pricing";

const FALLBACK_ORIGIN = "https://cardapio-cidadela.vercel.app";

/**
 * POST /api/payment/create-link
 *
 * Cria um link de pagamento pontual com Pix habilitado para um restaurante específico.
 *
 * Body: { storeId: string }
 * Requer Authorization: Bearer <access_token> e que o restaurante pertença ao
 * usuário — sem isso qualquer um poderia gerar cobranças para a loja de terceiros.
 */

export const Route = createFileRoute("/api/payment/create-link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) {
          return json({ error: "não autenticado" }, 401);
        }

        const mpToken = getMercadoPagoToken();
        if (!mpToken) {
          return json({ error: "Mercado Pago não configurado" }, 500);
        }

        let body: { storeId?: string } = {};
        try {
          body = (await request.json()) as { storeId?: string };
        } catch {
          return json({ error: "invalid body" }, 400);
        }

        const { storeId } = body;
        if (!storeId) {
          return json({ error: "storeId não fornecido" }, 400);
        }

        // Confirma a identidade e a posse do restaurante com o RLS do próprio
        // usuário (o service role abaixo é usado só para personalizar o nome).
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

        // Deriva a origem da própria requisição para back_url e webhook não
        // apontarem para um domínio fixo (que pode nem ser o de produção).
        const requestUrl = new URL(request.url);
        const forwardedHost = request.headers.get("x-forwarded-host");
        const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
        const origin = forwardedHost
          ? `${forwardedProto}://${forwardedHost}`
          : requestUrl.origin || FALLBACK_ORIGIN;
        const backUrl = `${origin}/admin/assinatura`;
        const notificationUrl = `${origin}/api/webhook/mercadopago`;

        // Busca o nome do restaurante para personalizar o pagamento
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("name")
          .eq("id", storeId)
          .maybeSingle();

        const restaurantName = (restaurant?.name as string) || "Cardápio Cidadela";

        const result = await createPaymentLink({
          title: `Cardápio Cidadela Premium - ${restaurantName}`,
          description: "Acesso Premium por 1 ano - Pedidos ilimitados",
          unitPrice: PREMIUM_PRICE_VALUE,
          externalReference: storeId,
          backUrl,
          notificationUrl,
        });

        if (!result) {
          return json({ error: "falha ao criar link de pagamento" }, 500);
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
