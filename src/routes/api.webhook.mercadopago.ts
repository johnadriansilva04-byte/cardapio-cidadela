import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import {
  getServerSupabase,
  getWebhookSecret,
  verifyMercadoPagoSignature,
  mpFetch,
} from "@/api/lib/mercadopago";
import { processPreapprovalById } from "@/api/lib/mp-subscription";

/**
 * POST /api/webhook/mercadopago
 *
 * Recebe notificações do Mercado Pago e ativa/cancela o Premium sozinho.
 *
 * Segurança: se `MERCADOPAGO_WEBHOOK_SECRET` estiver configurado, exige o header
 * `x-signature` válido. Sem o secret, responde mas ignora em produção — o
 * endereço do webhook é público e sem assinatura qualquer um poderia forjar
 * uma ativação. Também aceita `Authorization: Bearer <secret>` para testes.
 */
export const Route = createFileRoute("/api/webhook/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = getWebhookSecret();

        if (!secret) {
          // Sem secret não há como provar que a notificação veio do Mercado Pago.
          // Configurar MERCADOPAGO_WEBHOOK_SECRET é obrigatório em produção.
          console.warn(
            "[webhook/mercadopago] MERCADOPAGO_WEBHOOK_SECRET não configurado — assinatura não validada.",
          );
        }

        if (secret) {
          const url = new URL(request.url);
          const dataId =
            url.searchParams.get("data.id") ||
            url.searchParams.get("data_id") ||
            url.searchParams.get("id");
          const requestId = request.headers.get("x-request-id");
          const signature = request.headers.get("x-signature");
          const auth = request.headers.get("authorization") ?? "";

          const authorized =
            auth === `Bearer ${secret}` ||
            (await verifyMercadoPagoSignature({ signature, requestId, dataId, secret }));

          if (!authorized) {
            return new Response(JSON.stringify({ error: "invalid signature" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          body = {};
        }

        const url = new URL(request.url);
        const type = String(body.type ?? body.topic ?? url.searchParams.get("type") ?? "");
        const data = (body.data ?? {}) as Record<string, unknown>;
        const resourceId = String(
          data.id ?? body.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "",
        );

        const supabase = getServerSupabase();
        if (!supabase) {
          return new Response(JSON.stringify({ error: "supabase não configurado" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          if (type === "preapproval" || type === "subscription_preapproval") {
            const result = await processPreapprovalById(supabase, resourceId);
            return new Response(JSON.stringify({ received: true, ...result }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Pagamento pontual — ativa Premium por 1 ano
          if (type === "payment" || type === "merchant_order") {
            const { ok, data } = await mpFetch(`/payments/${resourceId}`);
            if (!ok || !data) {
              console.error("[webhook/mercadopago] Falha ao buscar pagamento:", resourceId);
              return new Response(JSON.stringify({ received: true, error: "payment not found" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }

            const payment = data as Record<string, unknown>;
            const status = String(payment.status ?? "");
            const externalReference = String(payment.external_reference ?? "");

            // Só processa pagamentos aprovados
            if (status !== "approved") {
              return new Response(JSON.stringify({ received: true, status }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }

            // external_reference deve conter o store_id
            if (!externalReference || externalReference.includes("@")) {
              // Não loga o valor: dados antigos podiam trazer um e-mail (PII) aqui.
              console.warn("[webhook/mercadopago] external_reference inválido (ignorado)");
              return new Response(JSON.stringify({ received: true, error: "invalid reference" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }

            // Ativa Premium por 1 ano. upsert para não depender de a linha já
            // existir — um UPDATE sem linha não gera erro e o pagamento ficava
            // "perdido" (200 ao MP, Premium nunca ativado).
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            const { data: activated, error } = await supabase
              .from("admin_trials")
              .upsert(
                {
                  store_id: externalReference,
                  is_premium: true,
                  premium_expires_at: expiresAt.toISOString(),
                },
                { onConflict: "store_id" },
              )
              .select("store_id");

            if (error || !activated?.length) {
              console.error("[webhook/mercadopago] Erro ao ativar Premium:", error);
              return new Response(
                JSON.stringify({ received: true, error: error?.message ?? "not activated" }),
                { status: 500, headers: { "Content-Type": "application/json" } },
              );
            }

            console.log("[webhook/mercadopago] Premium ativado para store:", externalReference);
            return new Response(
              JSON.stringify({ received: true, activated: true, storeId: externalReference }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // Outros tipos — registramos o recebimento para não gerar reentrega
          return new Response(JSON.stringify({ received: true, ignored: type || "unknown" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("[webhook/mercadopago]", e);
          // 500 faz o Mercado Pago reentregar a notificação.
          return new Response(JSON.stringify({ error: "processing failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
