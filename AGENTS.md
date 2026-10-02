<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Build & verification

- `npm run build` (Vite + Nitro). `npx tsc --noEmit` for types.
- `npm run test` (Vitest, jsdom). Config in `vitest.config.ts`, setup in
  `src/test/setup.ts`; `@` maps to `src/`. Component tests use
  `@testing-library/react` + `@testing-library/user-event`.
- `npm run lint` reports ~490 pre-existing errors repo-wide. Check only the
  files you touched (`npx eslint <paths>`); don't try to fix the baseline.
  `AdminDashboard.tsx` is unformatted upstream — its prettier errors predate any
  change, so don't "fix" them while touching the file.
- Import from the barrel when one exists (`@/modules/analytics`,
  `@/modules/mobile/orders`) instead of deep paths.
- No `.env` in the repo. Authenticated screens can't be exercised locally
  without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

## Architecture notes

- Account vs. store separation: `/admin/config` is only the account
  (photo, name, phone, password, sign-out/delete) — no navigation shortcuts.
  Store data (WhatsApp, address, PIX, fee, hours, logo, banner) lives in the
  restaurant, under the **Restaurantes** tab; app installation and alerts live
  in the mobile Gestão (`/mobile/config`). The sidebar already carries the
  navigation, so don't repeat it as cards inside Configurações.
- The sidebar has no "Configurações" item: the account card at the bottom
  (`AccountMenu`) is the single entry point to the config screen and shows the
  owner's photo. That photo is the **same logo as the restaurant** (replicated),
  not a separate upload: `admin.tsx` loads the owner's restaurants and passes
  the first `logo_url`; `AccountMenu` falls back to initials when there is none
  or the image fails. Don't add an avatar bucket/upload — the logo already lives
  in `restaurant-images` and is edited in the Restaurantes tab.
- Mobile app lives under `/mobile` (routes `mobile.tsx` layout +
  `mobile.index|dashboard|clientes|config`). Shared logic is in
  `src/modules/mobile/`, UI primitives in `src/modules/ui/`.
- `src/modules/mobile/store-context.tsx` wraps every mobile tab with a single
  `useOwnerOrders` load (restaurants, orders, realtime) plus the derived
  `primary` store and `openNow`. Tabs must read it via `useMobileStore()`
  instead of calling `useOwnerOrders` themselves — otherwise each tab repeats
  the queries and the shared header can't show the store status.
- Page chrome is shared, not per-tab: `PageHeader` (+ `StoreStatusBadge`) in
  `src/modules/ui/PageHeader.tsx`, and `LoadingState` / `EmptyState` /
  `InlineError` in `src/modules/ui/Feedback.tsx`. `AppLayout` already applies
  the page padding (`p-4 lg:p-6`), so route bodies use `space-y-*` only —
  adding another `p-4` doubles the mobile gutter.
- `StatTile` and the admin `KpiCard` animate their number via
  `useCountUp` (`src/hooks/useCountUp.ts`), which passes non-numeric text
  through untouched and honours `prefers-reduced-motion`.
- The mobile alerts banner (`src/components/mobile/AlertsBanner.tsx`) merges
  the old push + install prompts into one row and hides itself once
  notifications are granted and the app is installed.
- `src/routeTree.gen.ts` is generated. Adding a route requires regenerating it
  (dev server / build does this), otherwise the route silently doesn't exist.
- Per-device preferences (sound, notifications, wake lock, compact cards) live
  in `src/modules/mobile/preferences.ts` — localStorage, not the database.
  Operational sound belongs to the device at the counter, not the account.
- PWA install depends on a registered service worker. `public/sw.js` caches
  only hashed assets under `/assets/`; navigation and API responses always go
  to the network, so orders are never served from a stale cache.

## Orders, realtime and restaurant setup

- `restaurants.operating_hours` is a JSONB column that may be absent on older
  databases. `createRestaurant` / `updateRestaurant` retry without the column
  when Postgres complains; run `supabase/supabase_operating_hours_migration.sql`
  to add it.
- Storage policy requires the restaurant row to exist before its logo/banner
  can be uploaded. Creating a restaurant is therefore two steps internally:
  insert the row, then upload and patch the image URLs. The dialog returns the
  new id from `onSubmit` so the caller can patch it (`patchId`).
- `createOrder` dedupes on an idempotency key that includes the `comanda` —
  without it, the same customer reordering identical items was swallowed as a
  duplicate and never reached the restaurant.
- Every `subscribeToOrders` caller passes a distinct channel prefix
  (`mobile_orders`, `mobile_badge`, `admin_alert`, `customer_list`,
  `customer_order`). Supabase reuses channel topics by name, so sharing one
  means a screen unmounting tears down another screen's subscription.
- The order alert sound is synthesised with Web Audio in
  `src/lib/orderAlertSound.ts` (no asset file), with an in-memory WAV fallback.
  `AudioContext` starts suspended until a user gesture; the module registers a
  global unlock on the first pointer/key/touch.

- `orders` has RLS with no SELECT policy for customers — only
  `is_restaurant_owner`. A logged-in customer's history therefore cannot be read
  from the table directly; it comes from the `get_my_orders()` SECURITY DEFINER
  RPC (in `schema.sql`), mirroring `get_orders_by_guest()` for guests. Both
  return the same limited columns, and `getCustomerOrders` in
  `src/modules/supabase/customer.ts` only falls back to the guest id when the
  RPC is unavailable (schema not yet updated), never when the account genuinely
  has no orders.

## Analytics and reviews (new modules)

- `src/modules/analytics/` is provider-agnostic: it batches events and only
  sends when `VITE_ANALYTICS_ENDPOINT` is set. Consent is per device in
  localStorage and honours Do Not Track; `AnalyticsConsentCard` exposes the
  toggle in mobile settings. Never send PII — only counts and event names.
- Image optimization is opt-in per component: `optimizedImageUrl` rewrites
  Supabase Storage `/object/` URLs to `/render/image/` with transform params.
  Supabase image transforms are a paid feature, so `SmartImage` retries the
  original URL on `error` before giving up. Any other host is passed through.
- `src/modules/supabase/reviews.ts` treats a missing `reviews` table as "feature
  off" and surfaces `unavailable` instead of throwing, so the menu renders
  untouched until `supabase/supabase_reviews_migration.sql` is applied. The
  migration grants INSERT to `anon` deliberately (anonymous orders), which is
  why `submitReview` re-validates locally via `@/lib/reviews`.

## Public tracking and menu layout

- `order_tracking` / `get_order_tracking` are deliberately narrow (no PII), and
  `normalizeTrackingOrder` in `src/modules/supabase/orders.ts` fills the fields
  the tracking page formats (`subtotal`, `delivery_fee`, `delivery_type`,
  `payment_method`). Adding a `brl(order.<field>)` on that page without adding
  the field to the view/RPC crashes the whole route — the page has no error
  boundary, so it falls through to the generic "Algo deu errado".
- Changing a view's column list or a function's `RETURNS TABLE` needs a `DROP`
  first; `CREATE OR REPLACE` rejects both. The tracking view/function are
  dropped and recreated in `schema.sql` (grants are re-applied further down).
- The public menu hero is `sticky top-0 z-0` inside a `contents` wrapper, with
  the content on `relative z-10`, so the products scroll over a fixed banner.
  Keep the sticky/z-index pairing when touching that block. With a real banner
  the art is layered twice: a `blur-2xl scale-110` copy fills the frame
  (`cover`) while the sharp copy uses `background-size: contain` so the whole
  artwork — including any name baked into it — is never cropped; the hero is
  `overflow-hidden` so the blur can't bleed out. Nothing sits on the cover
  except the Cidadela seal (top-right); the identity block — avatar, name,
  status and slogan — lives in flow below the hero, avatar beside the text,
  so it never hides the art.
- The Cidadela seal is a `sticky top-0 z-30` sibling _before_ the hero, not a
  child of it. The hero is `z-0`, which creates its own stacking context, so
  nothing inside it can outrank the sticky category bar (`z-20`) — as a child
  the seal was painted over by that bar when it stuck. The wrapper is
  `pointer-events-none` with the badge `pointer-events-auto` so the empty
  strip never blocks taps on the art. `CidadelaBadge` drops its own `relative`
  when the caller passes a positioning class: `.relative` is emitted after
  `.absolute`, so both together made the badge ignore `absolute` and overflow
  the right edge.
- `RestaurantCardCompact` (admin list) applies the same idea to its cover: a
  `blur-xl` copy of the banner fills the frame while the sharp copy uses
  `object-contain`, so a 21:9 art — and any name baked into it — is never
  cropped by the card's shorter aspect. A logo used as fallback cover stays
  `object-contain`. The profile block is centred: the avatar uses
  `left-1/2 -translate-x-1/2` over the cover's bottom edge, and name,
  description and item count are centred under it — the name is a direct child
  of the centred column (no side chevron, which would offset it).
- The admin Configurações page is account-only: store fields (WhatsApp, PIX,
  hours) link out to `/admin/restaurantes` via a compact shortcut grid. The PWA
  `InstallCard` keeps its manual steps collapsed behind "Como instalar" so the
  page stays quiet.
- `sendToWhatsApp` strips non-digits from the number — wa.me rejects formatted
  phone numbers.

## Assinatura Premium (Mercado Pago)

- Plano gratuito: 5 pedidos/mês; Premium é ilimitado. O estado vive em
  `admin_trials` (uma linha por restaurante, `store_id` = `restaurants.id`),
  com `is_premium`, `premium_expires_at`, `monthly_order_count`,
  `monthly_order_reset_date` e `mercadopago_preapproval_id`. As colunas novas
  são adicionadas por `ALTER TABLE ... IF NOT EXISTS` no fim do bloco da tabela
  em `schema.sql`.
- `src/modules/supabase/subscription.ts` é a API de leitura/escrita do cliente
  (`checkSubscriptionStatus`, `checkMonthlyLimit`, `incrementOrderCount`,
  `activatePremium`, `cancelPremium`, ...). Ela cria a linha sob demanda e
  degrada em silêncio: sem as colunas/linha, o restaurante é tratado como
  gratuito e os pedidos continuam.
- `createOrder` incrementa o contador mensal só depois de persistir; a checagem
  é best-effort e não derruba o pedido.
- O limite NÃO bloqueia mais o cliente: `createOrder` sempre grava o pedido e
  apenas incrementa o contador. O bloqueio vive na **leitura dos detalhes pelo
  dono**, via RPC `get_order_for_owner` (SECURITY DEFINER, em `schema.sql`):
  Premium ou cota disponível devolve o pedido; senão `{ blocked: true }` e
  **nada do pedido vaza** — nem os itens. O lugar dos itens na tela é a ação de
  assinar: admin `OrderManager` e mobile `OrderCard` mostram o aviso, escondem
  a lista e põem o CTA "Assinar Premium agora · R$ 39,90/mês" (link
  `/admin/assinatura`, fluxo existente).
- A RPC `owner_locked_stores()` devolve os restaurantes do dono com a cota
  estourada; o `OrderManager` usa isso para marcar os cards (cadeado) e
  **esconder as ações** de avançar/cancelar (`onAdvance`/`onCancel` ficam
  `undefined` quando bloqueado) — o dono não processa o pedido enquanto não
  assinar. A tela também mostra um aviso no topo com o CTA "Assinar" (mesmo
  `/admin/assinatura`) e o card bloqueado ganha um atalho de assinatura no
  lugar dos itens; pedido novo entra com realce "Novo" + `slide-up` por 15s.
  O dono continua vendo que o pedido chegou. Como é leitura (não RLS), assinar
  o Premium libera automaticamente os pedidos que chegaram bloqueados.
- O mobile segue a mesma regra: `useOwnerOrders` (via `store-context`) carrega
  `getOwnerLockedStores()` junto dos pedidos e expõe `lockedStores` e
  `freshIds`; a aba `/mobile` mostra o aviso de plano com CTA para
  `/admin/assinatura` e passa `locked`/`fresh` ao `OrderCard`. O card bloqueado
  fica âmbar com cadeado no cabeçalho. O header do `/mobile` usa
  `env(safe-area-inset-top)` porque a PWA instalada (standalone +
  `viewport-fit=cover`) fica sob o notch.
- As duas RPCs são aditivas: sem elas no banco, `getOrderForOwner` cai para
  `getOrderById` (schema antigo) e `getOwnerLockedStores` devolve vazio — nada
  trava, só perde o enforcement. Se o e-mail/telefone da conta muda,
  `registerPendingSubscription` grava o novo; a vinculação do MP continua por
  e-mail (pseudo-email `telefone@menufacil.local`), por isso o aviso do modal
  fala em "telefone", nunca no endereço interno.
- O webhook é uma **server route** em `src/routes/api.webhook.mercadopago.ts`
  (`POST /api/webhook/mercadopago`), com a lógica compartilhada em
  `src/api/lib/{mercadopago,mp-subscription}.ts`. Rotas de API seguem a
  convenção de nome `src/routes/api.<segmento>.<segmento>.ts` e aparecem no
  `routeTree.gen.ts` como rotas normais.
- Segurança: o Access Token é server-only. Use `MERCADOPAGO_ACCESS_TOKEN` (não
  `VITE_*`) e configure `MERCADOPAGO_WEBHOOK_SECRET` para validar `x-signature`;
  sem o secret o webhook processa mas loga — em produção sempre configure-o.
- O link de assinatura do Mercado Pago é estático
  (`VITE_MERCADOPAGO_SUBSCRIPTION_LINK`) e não carrega `external_reference`. Por
  isso o restaurante é resolvido pelo e-mail do pagador, registrado antes do
  checkout via `registerPendingSubscription`. O modal avisa o usuário a usar o
  mesmo e-mail da conta.
- Fallback do webhook: `POST /api/subscription/sync` (rota
  `api.subscription.sync.ts`) busca o preapproval direto na API do MP. Exige
  token de sessão e só age se o e-mail do pagador bater com o registrado na
  linha — evita ativar o Premium de terceiros. A página `/admin/assinatura`
  expõe o botão "Sincronizar" para isso.

## MATA-FOME: retenção e imagens leves

- O sistema guarda só o que sustenta a operação (restaurante, cardápio,
  contador de cota). Pedido antigo e dado de cliente final são descartáveis.
  `supabase/supabase_retention.sql` (rodar uma vez no SQL Editor) cria
  `cleanup_old_data(30)` + dois jobs `pg_cron`: limpeza diária (03:00 UTC) e
  reset do contador mensal. `order_items`/`order_status_history` caem por
  `ON DELETE CASCADE`; `admin_trials` **nunca** é apagada.
- Toda imagem de restaurante (logo, banner e **produto**) passa por
  `src/lib/imageCompression.ts` antes do upload, dentro de
  `uploadRestaurantImage` — redimensiona para ≤ 800x800 e converte para WebP a
  70%. O bucket nunca recebe Base64 nem arquivo pesado, e `cacheControl` é de 1
  ano (o nome do arquivo carrega timestamp, então a URL é imutável). Se o
  navegador não gerar WebP, cai para o arquivo original em vez de falhar.
- `getMenuWithProducts` seleciona colunas explícitas (`CATEGORY_COLUMNS` /
  `PRODUCT_COLUMNS`), sem `select("*")`: `restaurant_id` e `created_at` ficam
  de fora porque o cardápio público não os usa — economiza KB por produto no
  celular do cliente. Ao adicionar um campo lido no cardápio, inclua-o nessas
  constantes ou ele virá `undefined`.
