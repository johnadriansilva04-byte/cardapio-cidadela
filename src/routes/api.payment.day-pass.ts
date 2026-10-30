import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getServerSupabase, getSupabaseForUser, getMercadoPagoToken } from "@/api/lib/mercadopago";
import { createPaymentLink } from "@/api/lib/mp-payment";
import { DAY_PASS_PRICE_VALUE } from "@/lib/pricing";

const FALLBACK_ORIGIN = "https://cardapio-cidadela.vercel.app";

/**
 * POST /api/payment/day-pass
 *
 * Cria um link de pagamento pontual (Pix) que libera a loja por 24 HORAS.
 *
 * Body: { storeId: string }
 * Requer Authorization: Bearer <access_token> e que o restaurante pertença ao
 * usuário — sem isso qualquer um geraria cobranças para a loja de terceiros.
 *
 * A concessão das 24h NÃO acontece aqui: quem concede é o webhook, ao receber
 * `metadata.kind = 'day_pass'` no pagamento aprovado (RPC `grant_day_pass`).
 * O cliente nunca escreve o acesso.
 */

export const Route = createFileRoute("/api/payment/day-pass")({
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

        let body: { storeId?: string; quantity?: number } = {};
        try {
          body = (await request.json()) as { storeId?: string; quantity?: number };
        } catch {
          return json({ error: "invalid body" }, 400);
        }

        const { storeId } = body;
        if (!storeId) {
          return json({ error: "storeId não fornecido" }, 400);
        }

        // Quantidade de diárias (pacote). O preço é recalculado AQUI, a partir
        // da constante do servidor — o cliente manda só a quantidade, nunca o
        // valor. Teto de 60 evita pedidos absurdos por engano/abuso.
        const quantity = Math.max(1, Math.min(Math.floor(Number(body.quantity ?? 1) || 1), 60));

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

        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("name")
          .eq("id", storeId)
          .maybeSingle();

        const restaurantName = (restaurant?.name as string) || "Cardápio Cidadela";

        const result = await createPaymentLink({
          title:
            quantity > 1
              ? `${quantity} diárias (24h cada) - ${restaurantName}`
              : `Acesso por 24h - ${restaurantName}`,
          description:
            quantity > 1
              ? `${quantity} × 24h de pedidos ilimitados — o tempo empilha`
              : "Libere o painel por 24 horas — pedidos ilimitados nesse período",
          unitPrice: DAY_PASS_PRICE_VALUE * quantity,
          externalReference: storeId,
          backUrl,
          notificationUrl,
          metadata: { kind: "day_pass", quantity },
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
