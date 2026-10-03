import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getServerSupabase, getMercadoPagoToken } from "@/api/lib/mercadopago";
import { createPaymentLink } from "@/api/lib/mp-payment";

/**
 * POST /api/payment/create-link
 *
 * Cria um link de pagamento pontual com Pix habilitado para um restaurante específico.
 *
 * Body: { storeId: string }
 */

export const Route = createFileRoute("/api/payment/create-link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabase = getServerSupabase();
        if (!supabase) {
          return new Response(JSON.stringify({ error: "supabase não configurado" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const token = getMercadoPagoToken();
        if (!token) {
          return new Response(JSON.stringify({ error: "Mercado Pago não configurado" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: { storeId?: string } = {};
        try {
          body = (await request.json()) as { storeId?: string };
        } catch {
          return new Response(JSON.stringify({ error: "invalid body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { storeId } = body;
        if (!storeId) {
          return new Response(JSON.stringify({ error: "storeId não fornecido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

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
          unitPrice: 199.99,
          externalReference: storeId,
          backUrl: "https://cardapiocidadela.com.br/admin/assinatura",
        });

        if (!result) {
          return new Response(JSON.stringify({ error: "falha ao criar link de pagamento" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
