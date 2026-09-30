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
| URLs de compartilhamento (`/admin/compartilhar`, `SharePanel`) | 🟡 | Link correto, mas base **hardcoded** `https://cardapio-cidadela.vercel.app` (produção real). Se mudar de domínio, trocar a constante — ideal `window.location.origin` |
| Componente `src/components/admin/AdminDashboard.tsx` | ❌ | **Código morto** — não importado por nenhuma rota. Contém preview de slug com URL hardcoded. Mantido intacto por ser legado upstream |
| Seed de menus (`seedDefaultMenu`) | ✅ | Cria Lanches/Bebidas/Combos reais no primeiro acesso |
| `ensureRestaurantsForUser` (admin_trials) | 🟡 | Legado de trials; inócuo quando não há linha em `admin_trials` |

## Telas públicas

| Recurso | Estado | Integração real |
| --- | --- | --- |
| Cardápio por slug (`/cardapio/$slug`) | ✅ | `getRestaurantBySlug` → menu real; pedido grava no tenant do slug |
| Checkout (taxa por bairro, PIX, WhatsApp) | ✅ | `createOrder` com idempotência por comanda |
| Rastreio de pedido (`/pedido/$id`) | ✅ | View `order_tracking` (sem PII) |
| Avaliações (`ReviewsSection`) | 🟡 | Requer migração `supabase_reviews_migration.sql`; some sozinha se ausente |
| Push de novo pedido (celular toca) | 🟡 | Requer deploy das Edge Functions (`notify-new-order`, `push-vapid-key`) |
| Landing `/` | ✅ | Após refactor: sem métricas inventadas (removidos "200+ restaurantes" e "4.9/5.0"); os selos listam apenas recursos que existem |
| Analytics (`src/modules/analytics`) | 🟡 | Só envia quando `VITE_ANALYTICS_ENDPOINT` está definido; consentimento por dispositivo |
| PRACINHA (assistente Gemini) | 🟡 | Requer `GEMINI_API_KEY` nas configurações; responde com aviso quando ausente |

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

- `AdminDashboard.tsx` e `RestaurantManager.tsx` são legados mortos (sem
  importadores); não receberam refactor para não inflar o diff.
- Base URL de produção hardcoded em 5 arquivos (ver tabela acima) —
  centralizar em `window.location.origin` quando houver domínio próprio.
