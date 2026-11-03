# Scripts do Projeto

## keep-alive.mjs

Mantém o projeto Supabase acordado no **plano gratuito**. O Free pausa o
projeto depois de **1 semana sem nenhuma requisição**, e um projeto pausado
derruba o app (a API responde 503) até alguém restaurar à mão. Este script faz
o mínimo: se a janela passou **sem** requisição, ele faz UMA.

Roda sozinho todo dia (workflow `.github/workflows/keep-alive.yml`) e também
pode ser rodado à mão:

```bash
npm run keep-alive
```

Lógica:
1. Com `SUPABASE_ACCESS_TOKEN`, lê o status do projeto e **restaura** se
   estiver pausado.
2. Lê o uso dos últimos 3 dias. Com qualquer requisição, **não pinga** — não
   gasta egress à toa.
3. Sem uso (ou sem token), faz um `GET` leve em `restaurants` com a anon key:
   é uma requisição REST de verdade e reseta o contador de inatividade.

Envs: `SUPABASE_URL` e `SUPABASE_ANON_KEY` (obrigatórias para o ping),
`SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF` (opcionais — habilitam a
checagem de uso e a restauração automática). No GitHub, os dois primeiros já
existem como `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; o
`SUPABASE_PROJECT_REF` também já está configurado.

> **Sem `SUPABASE_ACCESS_TOKEN` o workflow já resolve a pausa** — ele pinga
> todo dia (modo simples). O token só melhora: pula o ping quando já houve
> tráfego e restaura sozinho um projeto que tenha pausado. Se quiser o caminho
> completo, crie um PAT em supabase.com/dashboard/account/tokens (escopo de
> projetos) e salve como o secret `SUPABASE_ACCESS_TOKEN`. Nunca comite o
> token nem o use em log.

> A janela é de 3 dias, não 7: o próprio ping conta como requisição, então
> olhar 7 dias faria o keep-alive "esconder" a ociosidade e só pingar de novo
> ~8 dias depois — colado no limite de pausa.

## backup-to-r2.mjs / restore-from-r2.mjs

Backup diário dos dados do Supabase para o Cloudflare R2 (10 GB grátis) e
restauração. O plano gratuito do Supabase não tem backup automático — estes
scripts são a rede de segurança do cardápio e das assinaturas.

Documentação completa (o que é salvo, onde fica, secrets, como recuperar):
**[BACKUP.md](./BACKUP.md)**.

Uso rápido:

```bash
npm run backup                    # exporta e sobe para o R2
npm run backup -- --dry-run       # só exporta local (DRY_RUN=1)
npm run restore -- --latest       # mostra o plano de restauração
npm run restore -- --latest --confirm   # restaura de verdade
npm run backup:retention -- 3     # mantém os 3 backups mais recentes
```

O bucket guarda **3 dias** (hoje + ontem + anteontem); o R2 apaga o resto
sozinho. Detalhes em [BACKUP.md](./BACKUP.md).

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

