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

