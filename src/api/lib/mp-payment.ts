import { mpFetch, type ServerEnv } from "./mercadopago";

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
            : "https://cardapiocidadela.com.br/admin/assinatura?payment=success",
          failure: config.backUrl
            ? `${config.backUrl}?payment=failure`
            : "https://cardapiocidadela.com.br/admin/assinatura?payment=failure",
          pending: config.backUrl
            ? `${config.backUrl}?payment=pending`
            : "https://cardapiocidadela.com.br/admin/assinatura?payment=pending",
        },
        external_reference: config.externalReference,
        // Sem isto o webhook só chega se estiver configurado no painel do MP.
        notification_url: config.notificationUrl,
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
