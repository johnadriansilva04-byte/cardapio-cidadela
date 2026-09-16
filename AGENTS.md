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
- `npm run lint` reports ~490 pre-existing errors repo-wide. Check only the
  files you touched (`npx eslint <paths>`); don't try to fix the baseline.
- No `.env` in the repo. Authenticated screens can't be exercised locally
  without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; `.env.example` lists
  what to fill in. Vite inlines the values at build time, so changing them
  requires a new build/deploy — not just an env change on the host.
- On Vercel the two variables must be enabled for **both** Production and
  Preview. A variable scoped to Production only leaves every PR preview
  unconfigured, and `/login` renders "Supabase não configurado" there.

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

## Domain invariants

- Supabase env resolution lives only in `src/modules/supabase/client.ts`
  (`getSupabaseConfig` / `isSupabaseConfigured` / `missingSupabaseEnvVars`).
  `auth.ts` re-exports them; don't read `import.meta.env` directly elsewhere, or
  the client and the login gate can disagree about whether the app is
  configured.
- `orders` has RLS where only the restaurant owner can SELECT. Any read-back of
  an order by an anonymous/guest client must go through a SECURITY DEFINER RPC
  (`get_order_tracking`, `get_orders_by_guest`, `get_order_by_idempotency_key`).
  A plain `.from("orders").select()` from the public menu silently returns zero
  rows, which is what made retries look like duplicates.
- Order idempotency: the caller (public menu checkout) generates one token per
  checkout and reuses it while the confirmation is in flight, so a retry is
  deduped but a genuinely new identical order still creates a new row.
- `cancelled` orders never count as revenue or as a billable ticket. That rule
  lives in `computeMetrics`/`aggregateCustomers`/`dailyRevenue` and must stay
  consistent with the admin financeiro numbers.
- Order status progression lives in `src/lib/orderFlow.ts` (`nextStatusFor`).
  Withdrawal (`retirada`) orders skip `out_for_delivery`; don't re-add
  per-screen copies of the transition map.

