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
