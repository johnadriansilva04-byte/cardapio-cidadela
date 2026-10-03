# Scripts do Projeto

## create-payment-link.js

Este script cria um link de pagamento pontual (checkout pro) no Mercado Pago com Pix habilitado.

### Por que usar este script?

O Mercado Pago NÃO suporta Pix em planos de assinatura recorrentes (preapproval_plan). A solução é usar **pagamentos pontuais** com link de checkout, que aceita Pix, cartão de crédito/débito, boleto e dinheiro em conta.

### Como funciona

1. O cliente paga via Pix/cartão/boleto (pagamento único anual)
2. O webhook é notificado e ativa o Premium por 1 ano
3. Após 1 ano, o cliente pode renovar pagando novamente

### Como usar

1. Obtenha seu Access Token do Mercado Pago:
   - Acesse https://www.mercadopago.com.br/developers/panel
   - Vá em "Suas credenciais"
   - Copie o "Access Token" (Produção ou Teste)

2. Execute o script com o token:

```bash
node scripts/create-payment-link.js SEU_ACCESS_TOKEN
```

3. O script vai:
   - Criar um link de pagamento com as configurações padrão (R$ 499,90/ano)
   - Habilitar Pix, cartão de crédito/débito, boleto e dinheiro em conta
   - Retornar o ID da preferência e o link de checkout

4. Configure o link no seu projeto:

Adicione ao seu arquivo `.env`:
```
VITE_MERCADOPAGO_PAYMENT_LINK=https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=ID_DA_PREFERENCIA
```

### Personalizar o pagamento

Edite o arquivo `scripts/create-payment-link.js` e altere as configurações em `PAYMENT_CONFIG`:

```javascript
const PAYMENT_CONFIG = {
  title: "Nome do seu plano",
  description: "Descrição do plano",
  unit_price: 499.90, // Valor em reais
  currency_id: "BRL",
  auto_return: "approved",
};
```

## create-mp-plan.js (DEPRECATED)

Este script cria um plano de assinatura recorrente, mas **NÃO suporta Pix**. Use `create-payment-link.js` em vez disso para habilitar Pix.

O Mercado Pago tem um bug conhecido onde o Pix não aparece no checkout de assinaturas criadas pela interface do site/app. Mesmo via API, o Pix não é suportado em preapproval_plan (apenas cartão e dinheiro em conta).

Se você precisa de Pix, use `create-payment-link.js` para pagamentos pontuais anuais.

