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
        payment_methods: {
          excluded_payment_types: [],
          excluded_payment_methods: [],
        },
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
