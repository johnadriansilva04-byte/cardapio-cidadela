import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import {
  authorizeWebhookRequest,
  getServerSupabase,
  getWebhookAllowUnsigned,
  getWebhookSecret,
  mpFetch,
} from "@/api/lib/mercadopago";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/api/lib/rate-limit";
import { processPreapprovalById } from "@/api/lib/mp-subscription";

/**
 * POST /api/webhook/mercadopago
 *
 * Recebe notificações do Mercado Pago e ativa/cancela o Premium sozinho.
 *
 * Segurança (fail-closed): o endereço é público, então sem
 * `MERCADOPAGO_WEBHOOK_SECRET` configurado a requisição é RECUSADA (503) em vez
 * de processada. Antes bastava o secret faltar para qualquer um forjar uma
 * notificação e ativar o Premium de graça. Em dev local dá para liberar com
 * `MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED=1` — nunca em produção.
 *
 * Com o secret presente, exige `x-signature` HMAC válido (ou
 * `Authorization: Bearer <secret>` para testes manuais).
 */
export const Route = createFileRoute("/api/webhook/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // O Mercado Pago reenvia em rajada e o webhook é público, então o teto
        // é alto — serve só para barrar flood, não para limitar entrega legítima.
        const rl = checkRateLimit(`webhook:${getClientIp(request)}`, 120, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        const url = new URL(request.url);
        const secret = getWebhookSecret();
        const allowUnsigned = getWebhookAllowUnsigned();

        const auth = await authorizeWebhookRequest({
          secret,
          allowUnsigned,
          authorization: request.headers.get("authorization"),
          signature: request.headers.get("x-signature"),
          requestId: request.headers.get("x-request-id"),
          dataId:
            url.searchParams.get("data.id") ||
            url.searchParams.get("data_id") ||
            url.searchParams.get("id"),
        });

        if (!auth.ok) {
          // 503 (e não 401) quando o problema é configuração: sinaliza ao
          // Mercado Pago que a entrega pode ser tentada de novo depois de
          // corrigir o ambiente, em vez de tratar como assinatura inválida.
          const misconfigured = !secret;
          if (misconfigured) {
            console.error(
              "[webhook/mercadopago] RECUSADO: MERCADOPAGO_WEBHOOK_SECRET não configurado. " +
                "Configure o secret (ou, só em dev, MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED=1).",
            );
          }
          return new Response(JSON.stringify({ error: auth.reason }), {
            status: misconfigured ? 503 : 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          body = {};
        }

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

          // Pagamento pontual — `metadata.kind` decide o que conceder:
          //   'day_pass' → +24h de acesso (diária)
          //   'annual'   → Premium por 1 ano (comportamento legado)
          if (type === "payment" || type === "merchant_order") {
            // `payment` traz o id do pagamento; `merchant_order` traz o id da
            // ordem. O endpoint de pagamento exige o prefixo /v1 — sem ele a
            // API devolve 404 e o pagamento aprovado nunca vira acesso.
            let storeId = "";
            let approvedId = "";
            let kind = "";
            let quantity = 1;

            if (type === "payment") {
              const { ok, data } = await mpFetch(`/v1/payments/${resourceId}`);
              if (!ok || !data) {
                console.error("[webhook/mercadopago] Falha ao buscar pagamento:", resourceId);
                return new Response(
                  JSON.stringify({ received: true, error: "payment not found" }),
                  { status: 200, headers: { "Content-Type": "application/json" } },
                );
              }
              const payment = data as Record<string, unknown>;
              const status = String(payment.status ?? "");
              // Só processa pagamentos aprovados
              if (status !== "approved") {
                return new Response(JSON.stringify({ received: true, status }), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                });
              }
              storeId = String(payment.external_reference ?? "");
              approvedId = String(payment.id ?? resourceId);
              const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
              kind = String(metadata.kind ?? "");
              quantity = Math.max(1, Math.min(Math.floor(Number(metadata.quantity ?? 1) || 1), 60));
            } else {
              const { ok, data } = await mpFetch(`/merchant_orders/${resourceId}`);
              if (!ok || !data) {
                console.error("[webhook/mercadopago] Falha ao buscar ordem:", resourceId);
                return new Response(JSON.stringify({ received: true, error: "order not found" }), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                });
              }
              const order = data as Record<string, unknown>;
              storeId = String(order.external_reference ?? "");
              const payments = (order.payments as Array<Record<string, unknown>>) ?? [];
              const approved = payments.find((p) => String(p.status ?? "") === "approved");
              if (!approved) {
                return new Response(JSON.stringify({ received: true, status: order.status }), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                });
              }
              approvedId = String(approved.id ?? "");
              const metadata = (order.metadata ?? {}) as Record<string, unknown>;
              kind = String(metadata.kind ?? "");
              quantity = Math.max(1, Math.min(Math.floor(Number(metadata.quantity ?? 1) || 1), 60));
            }

            // external_reference deve conter o store_id
            if (!storeId || storeId.includes("@")) {
              // Não loga o valor: dados antigos podiam trazer um e-mail (PII) aqui.
              console.warn("[webhook/mercadopago] external_reference inválido (ignorado)");
              return new Response(JSON.stringify({ received: true, error: "invalid reference" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }

            // DIÁRIA (24h): concede pela RPC SECURITY DEFINER, idempotente pelo
            // id do pagamento. O cliente nunca grava isto direto — o EXECUTE da
            // função é só da service role.
            if (kind === "day_pass") {
              const { data: unlockedUntil, error } = await supabase.rpc("grant_day_pass", {
                p_store: storeId,
                p_mp_payment_id: approvedId || null,
                p_amount_cents: 149,
                p_source: "pix",
                p_quantity: quantity,
              });
              if (error) {
                console.error("[webhook/mercadopago] Erro ao conceder diária:", error);
                return new Response(JSON.stringify({ received: true, error: error.message }), {
                  status: 500,
                  headers: { "Content-Type": "application/json" },
                });
              }
              console.log("[webhook/mercadopago] Diária concedida para store:", storeId);
              return new Response(
                JSON.stringify({ received: true, dayPass: true, storeId, unlockedUntil }),
                { status: 200, headers: { "Content-Type": "application/json" } },
              );
            }

            // MENSAL (30 dias): ativa Premium até daqui a 30 dias. Mesmo upsert
            // do anual, só muda a janela — o `kind` vem do metadata que a rota
            // /api/payment/monthly gravou na preferência.
            if (kind === "monthly") {
              const monthlyExpires = new Date();
              monthlyExpires.setDate(monthlyExpires.getDate() + 30);

              const { data: activated, error } = await supabase
                .from("admin_trials")
                .upsert(
                  {
                    store_id: storeId,
                    is_premium: true,
                    premium_expires_at: monthlyExpires.toISOString(),
                    mercadopago_preapproval_id: approvedId || null,
                  },
                  { onConflict: "store_id" },
                )
                .select("store_id");

              if (error || !activated?.length) {
                console.error("[webhook/mercadopago] Erro ao ativar mensal:", error);
                return new Response(
                  JSON.stringify({ received: true, error: error?.message ?? "not activated" }),
                  { status: 500, headers: { "Content-Type": "application/json" } },
                );
              }

              console.log("[webhook/mercadopago] Premium mensal ativado para store:", storeId);
              return new Response(
                JSON.stringify({ received: true, activated: true, monthly: true, storeId }),
                { status: 200, headers: { "Content-Type": "application/json" } },
              );
            }

            // ANUAL: ativa Premium por 1 ano. upsert para não depender de a
            // linha já existir — um UPDATE sem linha não gera erro e o
            // pagamento ficava "perdido" (200 ao MP, Premium nunca ativado).
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            const { data: activated, error } = await supabase
              .from("admin_trials")
              .upsert(
                {
                  store_id: storeId,
                  is_premium: true,
                  premium_expires_at: expiresAt.toISOString(),
                  mercadopago_preapproval_id: approvedId || null,
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

            console.log("[webhook/mercadopago] Premium ativado para store:", storeId);
            return new Response(JSON.stringify({ received: true, activated: true, storeId }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
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
