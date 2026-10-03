/**
 * Script para criar um link de pagamento pontual (checkout pro) no Mercado Pago com Pix habilitado.
 *
 * Uso:
 * node scripts/create-payment-link.js SEU_ACCESS_TOKEN
 *
 * O link de pagamento pontual aceita Pix, cartão de crédito/débito, boleto e dinheiro em conta.
 */

const ACCESS_TOKEN = process.argv[2];

if (!ACCESS_TOKEN) {
  console.error("ERRO: Access Token não fornecido");
  console.error("Uso: node scripts/create-payment-link.js SEU_ACCESS_TOKEN");
  process.exit(1);
}

// Configurações do pagamento
const PAYMENT_CONFIG = {
  title: "Cardápio Cidadela Premium - Anual",
  description: "Acesso Premium por 1 ano - Pedidos ilimitados",
  unit_price: 199.99, // Valor anual (R$ 199,99) - ajuste conforme necessário
  currency_id: "BRL",
  auto_return: "approved", // Redireciona após pagamento aprovado
};

async function createPaymentLink() {
  try {
    console.log("Criando link de pagamento pontual no Mercado Pago...");
    console.log("Configuração:", JSON.stringify(PAYMENT_CONFIG, null, 2));

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: PAYMENT_CONFIG.title,
            description: PAYMENT_CONFIG.description,
            quantity: 1,
            currency_id: PAYMENT_CONFIG.currency_id,
            unit_price: PAYMENT_CONFIG.unit_price,
          },
        ],
        auto_return: PAYMENT_CONFIG.auto_return,
        back_urls: {
          success: "https://cardapiocidadela.com.br/admin/assinatura?payment=success",
          failure: "https://cardapiocidadela.com.br/admin/assinatura?payment=failure",
          pending: "https://cardapiocidadela.com.br/admin/assinatura?payment=pending",
        },
        // Deixa o Mercado Pago decidir os métodos disponíveis
        // payment_methods: {
        //   excluded_payment_types: [],
        //   excluded_payment_methods: [],
        // },
        // Sem expiração - link válido indefinidamente
        expires: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("ERRO ao criar link de pagamento:");
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log("\n✅ Link de pagamento criado com sucesso!");
    console.log("\nID da preferência:", data.id);
    console.log("Título:", PAYMENT_CONFIG.title);
    console.log("Valor:", PAYMENT_CONFIG.unit_price);
    console.log("Descrição:", PAYMENT_CONFIG.description);

    console.log("\n🔗 Link de checkout (aceita Pix, cartão, boleto):");
    console.log(data.init_point);

    console.log("\n📋 Para usar no seu projeto:");
    console.log("Adicione ao seu .env:");
    console.log(`VITE_MERCADOPAGO_PAYMENT_LINK=${data.init_point}`);
    console.log(`VITE_MERCADOPAGO_PREFERENCE_ID=${data.id}`);

    console.log("\n💡 Notas:");
    console.log("- Este link não expira - válido indefinidamente");
    console.log("- Você pode usar sempre o mesmo link para todos os clientes");
    console.log("- O webhook precisa estar configurado para ativar o Premium automaticamente");

  } catch (error) {
    console.error("ERRO:", error.message);
    process.exit(1);
  }
}

createPaymentLink();
