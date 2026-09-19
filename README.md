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

O fluxo completo: **novo pedido → trigger no banco → Edge Function → Firebase Cloud Messaging → service worker → notificação + vibração**.

1. **Banco** — no SQL Editor, rode na ordem:
   - [`supabase/schema.sql`](./supabase/schema.sql)
   - [`supabase/push_subscriptions_migration.sql`](./supabase/push_subscriptions_migration.sql)
   - [`supabase/push_trigger_migration.sql`](./supabase/push_trigger_migration.sql) — cria o trigger que dispara o push a cada pedido.
2. **Configurações do projeto** — o trigger lê `app.settings.base_url` (ex.: `https://SEU-PROJETO.supabase.co`) e `app.settings.anon_key`. Configure em *Dashboard → Database → Settings → App settings* (ou ajuste as chaves no SQL).
3. **Firebase** — crie um projeto em [console.firebase.google.com](https://console.firebase.google.com), adicione um app Web e copie as chaves para o `.env.local`:

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_VAPID_KEY=...   # Cloud Messaging → Web Push certificates
   ```

4. **Edge Function** — faça deploy uma vez:

   ```sh
   supabase functions deploy send-push-notification
   supabase secrets set FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY=...
   ```

   As credenciais vêm do service account do Firebase (*Project Settings → Service accounts → Generate new private key*).
5. **No celular** — abra o app, toque em **“Receber alerta de pedidos”** (banner azul) e autorize. Isso grava o token do dispositivo em `push_subscriptions`.

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
