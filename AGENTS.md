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

- Mobile app lives under `/mobile` (routes `mobile.tsx` layout +
  `mobile.index|dashboard|clientes|config`). Shared logic is in
  `src/modules/mobile/`, UI primitives in `src/modules/ui/`.
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
  Keep the sticky/z-index pairing when touching that block.
- `sendToWhatsApp` strips non-digits from the number — wa.me rejects formatted
  phone numbers.

