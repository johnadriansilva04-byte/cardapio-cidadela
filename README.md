# Cardápio Cidadela

Cardápio digital profissional para restaurantes. Pedidos em tempo real, pagamento via PIX, impressão de comanda térmica, pontos de soberania e painel administrativo completo.

## Setup do Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Defina as variáveis de ambiente no seu `.env.local`:

   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon
   ```

3. **Aplique o schema** abrindo o banco do projeto → **SQL Editor** → cole o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql) → **Run**. Esse arquivo único substitui qualquer schema anterior, cria as tabelas, políticas RLS (insert anônimo de pedidos + leitura pública do cardápio), funções de rastreamento (`get_order_tracking`) e o seed de exemplo.

> ⚠️ O arquivo `supabase/schema.sql` é a **única** fonte da verdade do banco.
> Execute-o por inteiro no SQL Editor sempre que atualizar o schema.

## Notificações push (celular toca com o app fechado)

Fluxo: **novo pedido → cliente chama a Edge Function → Web Push nativo (RFC 8291/VAPID) → service worker → notificação + vibração**.

Não usa Firebase nem variáveis de ambiente — a chave VAPID é gerada automaticamente na primeira execução e guardada no banco (`push_vapid`).

1. **Banco** — no SQL Editor, rode [`supabase/schema.sql`](./supabase/schema.sql) (uma vez). Ele já cria `push_vapid` e `push_subscriptions`.
2. **Edge Functions** — faça o deploy uma vez:

   ```sh
   supabase functions deploy notify-new-order
   supabase functions deploy push-vapid-key
   ```

3. **No celular** — abra o app, toque em **“Receber alerta de pedidos”** (banner azul) e autorize. Pronto: cada pedido novo faz o celular tocar, mesmo com o app fechado.

Esse projeto usa o [Lovable](https://lovable.dev) — commits pushados aparecem no editor.

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

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
