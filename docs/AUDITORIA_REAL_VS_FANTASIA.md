# Auditoria Real vs. Fantasia — Cardápio Cidadela

Inventário dos recursos de UI mapeados contra a integração real de backend
(Supabase). Gerado na refatoração de UI/UX — atualizar ao adicionar recursos.

Legenda: ✅ real (dados do banco) · 🟡 condicional (funciona, mas depende de
config/setup) · ❌ fantasia (só visual, sem backend).

## Painel admin (`/admin`)

| Recurso | Estado | Integração real |
| --- | --- | --- |
| KPIs (Faturamento, Pedidos, Ticket médio, Restaurantes) | ✅ | `orders` do Supabase com filtro de período (`admin.index.tsx`) |
| Donut "Pedidos por status" | ✅ | Contagem real por status das mesmas ordens |
| Contagem de itens no card dos restaurantes | ✅ | Tabela `products` (soma por `restaurant_id`) |
| Cardápio em `/admin/restaurante/$id` | ✅ | Realtime em `products`/`categories` |
| Kanban de pedidos em `/admin/pedidos` | ✅ | Realtime `orders_pedidos_${id}` + polling 15s |
| Badge/som de novo pedido no layout | ✅ | Canal `admin_alert_${id}` (`admin.tsx`) |
| Financeiro (`/admin/financeiro`) | ✅ | Gráficos + CSV exportado dos pedidos reais; comparação com período anterior |
| URLs de compartilhamento (`/admin/compartilhar`, `SharePanel`) | ✅ | Base centralizada em `src/lib/site.ts` (`SITE_URL` / `currentOrigin()`, configurável por `VITE_SITE_URL`). Não há mais literal hardcoded |
| Seed de menus (`seedDefaultMenu`) | ✅ | Cria Lanches/Bebidas/Combos reais no primeiro acesso |
| `ensureRestaurantsForUser` (admin_trials) | 🟡 | Legado de trials; inócuo quando não há linha em `admin_trials` |

## Telas públicas

| Recurso | Estado | Integração real |
| --- | --- | --- |
| Cardápio por slug (`/cardapio/$slug`) | ✅ | `getRestaurantBySlug` → menu real; pedido grava no tenant do slug |
| Checkout (taxa por bairro, PIX, WhatsApp) | ✅ | `createOrder` com idempotência por comanda |
| Rastreio de pedido (`/pedido/$id`) | ✅ | View `order_tracking` (sem PII) |
| Avaliações (`ReviewsSection`) | 🟡 | Requer migração `supabase_reviews_migration.sql`; some sozinha se ausente |
| Push de novo pedido (celular toca) | 🟡 | Requer deploy das Edge Functions (`notify-new-order`, `notify-reward`, `push-vapid-key`) |
| Landing `/` | ✅ | Após refactor: sem métricas inventadas (removidos "200+ restaurantes" e "4.9/5.0"); os selos listam apenas recursos que existem |
| Analytics (`src/modules/analytics`) | 🟡 | Só envia quando `VITE_ANALYTICS_ENDPOINT` está definido; consentimento por dispositivo |

## Multi-tenancy (isolation audit)

1. `/cardapio/$slug` resolve o restaurante **pelo slug** e passa `restaurant.id`
   explícito para `createOrder` — o pedido nasce no tenant correto.
2. `cartScope.ts` (`discardCartIfForeign`) descarta carrinho de outro
   restaurante ao abrir um cardápio diferente (comparação por `restaurant_id`
   persistido junto das linhas).
3. RLS (`supabase/schema.sql`): insert anônimo permitido em `orders` apenas com
   `restaurant_id` válido; leitura de dono via `auth.uid() = owner_id`.
4. Realtime: cada tela usa prefixo de canal próprio (`orders_pedidos_`,
   `admin_alert_`, `mobile_orders`, `customer_order`, `public-menu-`) com filtro
   `restaurant_id=eq.${id}` — sem vazamento entre tenants.

## Dívida conhecida (não bloqueia)

- Lint com ~490 erros pré-existentes repo-wide (baseline do Lovable); não quebra
  build. Confira apenas os arquivos que você tocou.
- Sem `LICENSE` no repositório e sem CI (`.github/workflows`) rodando typecheck,
  testes e build a cada push.
