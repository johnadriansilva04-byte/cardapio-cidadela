import { mpFetch, type ServerEnv } from "./mercadopago";
import { SITE_URL } from "@/lib/site";

/**
 * Cria um link de pagamento pontual (checkout pro) com Pix habilitado.
 *
 * O external_reference é usado para vincular o pagamento ao restaurante.
 */

export interface PaymentLinkConfig {
  title: string;
  description: string;
  unitPrice: number;
  externalReference: string;
  backUrl?: string;
  /** URL que o Mercado Pago chama a cada mudança de status do pagamento. */
  notificationUrl?: string;
  /** Metadados da preferência. `kind` diz ao webhook o que conceder. */
  metadata?: Record<string, unknown>;
}

export async function createPaymentLink(
  config: PaymentLinkConfig,
  env?: ServerEnv,
): Promise<{ initPoint: string; preferenceId: string } | null> {
  const response = await mpFetch(
    "/checkout/preferences",
    {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            title: config.title,
            description: config.description,
            quantity: 1,
            currency_id: "BRL",
            unit_price: config.unitPrice,
          },
        ],
        auto_return: "approved",
        back_urls: {
          success: config.backUrl
            ? `${config.backUrl}?payment=success`
            : `${SITE_URL}/admin/assinatura?payment=success`,
          failure: config.backUrl
            ? `${config.backUrl}?payment=failure`
            : `${SITE_URL}/admin/assinatura?payment=failure`,
          pending: config.backUrl
            ? `${config.backUrl}?payment=pending`
            : `${SITE_URL}/admin/assinatura?payment=pending`,
        },
        external_reference: config.externalReference,
        // Sem isto o webhook só chega se estiver configurado no painel do MP.
        notification_url: config.notificationUrl,
        // `kind` é o que permite o webhook único decidir entre diária (24h) e
        // anual (1 ano) sem precisar de endpoint separado por produto.
        ...(config.metadata ? { metadata: config.metadata } : {}),
        // Deixa o Mercado Pago decidir os métodos disponíveis
        // payment_methods: {
        //   excluded_payment_types: [],
        //   excluded_payment_methods: [],
        // },
        expires: false,
      }),
    },
    env,
  );

  if (!response.ok || !response.data) return null;

  const data = response.data as { id: string; init_point: string };
  return {
    preferenceId: data.id,
    initPoint: data.init_point,
  };
}

/**
 * Assinatura recorrente (preapproval) do Mercado Pago.
 *
 * Diferente do link pontual, o preapproval cobra sozinho a cada ciclo e só
 * pode ser cancelado por `cancelPreapproval` — parar de cobrar depende de
 * avisar o Mercado Pago, não basta limpar o acesso local.
 */
export interface PreapprovalConfig {
  reason: string;
  externalReference: string;
  /** Valor cobrado a cada ciclo, em reais. */
  unitPrice: number;
  payerEmail?: string;
  backUrl?: string;
  notificationUrl?: string;
  /** Ciclo da cobrança. Padrão: 1 mês. */
  frequencyType?: "months" | "days";
  frequency?: number;
}

/**
 * Monta o corpo do preapproval. É função pura para o formato (o mais fácil de
 * errar) ficar coberto por teste sem rede.
 */
export function buildPreapprovalBody(config: PreapprovalConfig): Record<string, unknown> {
  return {
    reason: config.reason,
    external_reference: config.externalReference,
    ...(config.payerEmail ? { payer_email: config.payerEmail } : {}),
    ...(config.backUrl ? { back_url: config.backUrl } : {}),
    ...(config.notificationUrl ? { notification_url: config.notificationUrl } : {}),
    // "pending" = a assinatura só existe depois que o pagador autorizar no
    // checkout; o webhook confirma e ativa.
    status: "pending",
    auto_recurring: {
      frequency: config.frequency ?? 1,
      frequency_type: config.frequencyType ?? "months",
      transaction_amount: config.unitPrice,
      currency_id: "BRL",
    },
  };
}

/** Cria a assinatura recorrente e devolve o link de autorização. */
export async function createPreapproval(
  config: PreapprovalConfig,
  env?: ServerEnv,
): Promise<{ preapprovalId: string; initPoint: string } | null> {
  const response = await mpFetch(
    "/preapproval",
    { method: "POST", body: JSON.stringify(buildPreapprovalBody(config)) },
    env,
  );
  if (!response.ok || !response.data) {
    // Log do motivo real do MP (400 costuma ser `payer_email` ausente/inválido
    // ou valor fora do mínimo) — sem isto o erro vira um 500 opaco no painel.
    console.error("[mp] createPreapproval falhou", response.status, response.data);
    return null;
  }

  const data = response.data as { id?: string; init_point?: string };
  if (!data.id || !data.init_point) return null;
  return { preapprovalId: data.id, initPoint: data.init_point };
}

/**
 * Cancela a assinatura no Mercado Pago (PUT com status `cancelled`).
 *
 * Sem isto, cancelar no painel só limpava o acesso local e o Mercado Pago
 * continuava cobrando o cartão — o pior defeito possível numa assinatura.
 */
export async function cancelPreapproval(preapprovalId: string, env?: ServerEnv): Promise<boolean> {
  if (!preapprovalId) return false;
  const response = await mpFetch(
    `/preapproval/${encodeURIComponent(preapprovalId)}`,
    { method: "PUT", body: JSON.stringify({ status: "cancelled" }) },
    env,
  );
  return response.ok;
}
