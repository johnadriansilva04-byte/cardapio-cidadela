# Cardápio Cidadela

Cardápio digital profissional para restaurantes. Pedidos em tempo real, pagamento via PIX, impressão de comanda térmica, pontos de soberania e painel administrativo completo.

## Setup do Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Defina as variáveis de ambiente no seu `.env.local`. O mínimo para o app
   subir é o Supabase; o restante (pagamento, analytics) é opcional e está
   documentado em [`.env.example`](./.env.example):

   ```
   # Cliente (vão para o bundle — prefixo VITE_)
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon

   # Servidor (NUNCA com prefixo VITE_ — usadas pelas rotas de API)
   SUPABASE_URL=https://SEU-PROJETO.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
   MERCADOPAGO_ACCESS_TOKEN=seu-access-token
   MERCADOPAGO_WEBHOOK_SECRET=seu-webhook-secret
   ```

   > ⚠️ `SUPABASE_SERVICE_ROLE_KEY` e `MERCADOPAGO_ACCESS_TOKEN` são **server-only**.
   > Nunca use o prefixo `VITE_` nelas: tudo com `VITE_` é embutido no bundle e
   > fica visível para qualquer visitante.

3. **Aplique as migrações** — o banco não vem de um arquivo só. Rode **todos**
   os arquivos de [`supabase/`](./supabase), **nesta ordem**:

   | # | Arquivo | O que cria |
   | --- | --- | --- |
   | 1 | `schema.sql` | Base: tabelas, RLS, `create_order_atomic`, `get_order_tracking`, seed |
   | 2 | `supabase_customer_loyalty_migration.sql` | Pontos de fidelidade do cliente |
   | 3 | `supabase_reviews_migration.sql` | Avaliações (tabela `reviews`) |
   | 4 | `supabase_premium_guard_migration.sql` | Guard do Premium + RPCs de cota |
   | 5 | `supabase_rewards_migration.sql` | Bônus por engajamento + `pg_cron` |
   | 6 | `supabase_day_pass_migration.sql` | Diária de 24h (`store_day_passes`) |
   | 7 | `supabase_day_pass_rewards_migration.sql` | Diárias como recompensa |
   | 8 | `supabase_retention.sql` | Retenção de 30 dias + `pg_cron` |

   **Maneira recomendada (sem Docker, sem conexão direta ao Postgres):**

   ```sh
   SUPABASE_ACCESS_TOKEN=sbp_xxx \
   SUPABASE_PROJECT_REF=xxxxxxxxxxxxxxxxxxxx \
   node supabase/apply-all.mjs
   ```

   `DRY_RUN=1 node supabase/apply-all.mjs` só lista os arquivos e valida o token.
   O script aplica os 8 arquivos na ordem acima via Management API.

   **Alternativa manual:** abra o banco do projeto → **SQL Editor** → cole o
   conteúdo de cada arquivo, na mesma ordem, e rode um por um.

> ⚠️ `schema.sql` é a base, mas **não é a única fonte da verdade**: as migrações
> 2–8 são incrementais e obrigatórias. Rodar só o `schema.sql` deixa o banco sem
> avaliações, recompensas, diária e sem o guard do Premium.

## Notificações push (celular toca com o app fechado)

Fluxo: **novo pedido → cliente chama a Edge Function → Web Push nativo (RFC 8291/VAPID) → service worker → notificação + vibração**.

Não usa Firebase nem variáveis de ambiente — a chave VAPID é gerada automaticamente na primeira execução e guardada no banco (`push_vapid`).

1. **Banco** — aplique as migrações (passo 3 acima, uma vez). O `schema.sql` já cria `push_vapid` e `push_subscriptions`.
2. **Edge Functions** — faça o deploy uma vez:

   ```sh
   supabase functions deploy notify-new-order
   supabase functions deploy notify-reward
   supabase functions deploy push-vapid-key
   ```

3. **No celular** — abra o app, toque em **“Receber alerta de pedidos”** (banner azul) e autorize. Pronto: cada pedido novo faz o celular tocar, mesmo com o app fechado.

## Cobrança (Mercado Pago)

Três produtos, todos com o preço recalculado no servidor (o cliente nunca manda
o valor) e a ativação só no webhook:

| Produto | Como cobra | Rota que cria |
| --- | --- | --- |
| **Premium mensal** | Assinatura recorrente (todo mês) | `POST /api/payment/subscribe` `{billing:"monthly"}` |
| **Premium anual** | Assinatura recorrente (a cada 12 meses) | `POST /api/payment/subscribe` `{billing:"annual"}` |
| **Diária (24h)** | Pagamento pontual, empilhável | `POST /api/payment/day-pass` |

A assinatura é um **preapproval** do Mercado Pago: ele cobra sozinho a cada
ciclo, então a loja não bloqueia quando o dono esquece de renovar. Cancelar
(`POST /api/subscription/cancel`) **avisa o Mercado Pago** antes de limpar o
acesso — sem isso o cartão continuaria sendo cobrado.

Configure no `.env` (ver [`.env.example`](./.env.example)):
`MERCADOPAGO_ACCESS_TOKEN` (server-only) e `MERCADOPAGO_WEBHOOK_SECRET` (a
assinatura secreta do webhook, não o Client Secret). Aponte o webhook do painel
do Mercado Pago para `https://SEU-DOMINIO/api/webhook/mercadopago`.

> ⚠️ **Nota fiscal:** o app **não emite** NF-e nem NFS-e — a comanda térmica é
> cupom não fiscal. Para emitir nota do serviço é preciso integrar um provedor
> de NFS-e, e o enquadramento fiscal precisa comportar venda de software
> (ver `AGENTS.md`).

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
