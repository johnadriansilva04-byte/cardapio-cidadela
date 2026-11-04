## Build & verification

- `npm run build` (Vite + Nitro). `npx tsc --noEmit` for types.
- `npm run test:e2e` (Playwright, chromium). Sobe o dev server com `E2E=1`,
  que troca o SDK do Supabase por um backend em memória
  (`src/e2e/supabase-stub.ts`) — não precisa de projeto Supabase real. O stub
  também implementa a RPC `create_order_atomic`, então o E2E prova de ponta a
  ponta que o preço é recalculado no "servidor" e que um item indisponível
  bloqueia o pedido. O QueryBuilder do stub suporta `.gte/.lte/.gt/.lt` (o
  Financeiro filtra `created_at` por faixa — sem eles a tela travava em
  "Carregando"). Config em `playwright.config.ts`, specs em `e2e/`.
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
- Pricing is server-authoritative: `orders`/`order_items`/`order_status_history`
  have **no** public INSERT policy. The only client write path is the
  `create_order_atomic` RPC (SECURITY DEFINER), which recomputes
  unit_price/subtotal/frete/total from `products`/`product_addons`/
  `delivery_neighborhoods` and writes order + items + history in one
  transaction. `createOrder` calls it and only falls back to the legacy
  client-side path when the RPC is absent (old schema). Never reintroduce
  `WITH CHECK (true)` inserts — the client could forge the total before this.
- `cidadela_unlocks` INSERT requires `order_belongs_to_restaurant(order_id,
  restaurant_id)`; the public history insert policy was removed (the RPC writes
  the initial `received` row).
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
- Public menu images go through `SmartImage` (logo, product photo): it tries the
  Supabase `/render/image/` transform and falls back to the original URL, so a
  project without the paid transform still shows the photo instead of a broken
  icon. Product tiles request a 136px `cover` crop.
- The public menu uses both brand colours: `primary_color` is the accent (prices,
  buttons, borders) and `secondary_color` feeds the second radial glow in the
  no-banner hero. Before, the secondary colour was only editable in the dialog
  and never reached the customer's screen.
- `ensureRestaurantsForUser` (legacy `admin_trials` import) no longer republishes
  a slug whose row is empty (no `logo_url`/`banner_url`) and skips legacy rows
  without a real `store_name`. That empty row was the "phantom restaurant" that
  kept coming back and stealing the public link. It still adopts a slug that
  belongs to another owner, and still inserts when the owner has none.
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

- **Pacotes são uma fonte única: `src/lib/plans.ts`.** Define Gratuito, Mensal
  (R$ 28,99) e Anual (R$ 199,99) com a lista de recursos por chave
  (`PLAN_FEATURES`). A landing (`index.tsx`) e a assinatura
  (`admin.assinatura.tsx`) renderizam `PlanCards` (`src/modules/ui/PlanCards.tsx`)
  a partir dela — não duplique a lista de recursos em JSX. A diária continua
  sendo compra avulsa (não é pacote) e vive em `pricing.ts`.
- **O recurso de foto é o diferencial do Anual.** Ler o cardápio por FOTO
  (`/api/menu/scan` → Workers AI `@cf/meta/llama-3.2-11b-vision-instruct`) custa
  token de imagem por uso, então é exclusivo do ciclo ANUAL; o Mensal monta por
  conversa (Pracinha). O gate é no SERVIDOR: a rota lê `store_access_state` com o
  RLS do usuário e exige `premium_cycle = 'annual'`. A UI só esconde/mostra —
  nunca é a barreira.
- **O ciclo do Premium vive em `admin_trials.premium_cycle`** (`'monthly'` |
  `'annual'`), escrito só pelo webhook/sync (service role) e protegido pelo
  `guard_admin_trials_premium` (o dono não pode gravar — senão um `PATCH
  premium_cycle='annual'` liberaria a foto de graça). `store_access_state` expõe
  `premium_cycle`; sem a migração
  (`supabase_premium_cycle_migration.sql`) o campo vem nulo e o recurso fica
  bloqueado (fail-closed). `PreapprovalInfo.cycle` deriva de `auto_recurring.frequency`
  (12 = anual).
- **A foto vira itens sem gravar sozinha.** `/api/menu/scan` só devolve a
  sugestão (`parseMenuScan` valida/limpa, ≤ 40 itens); quem grava é
  `importScannedMenu` (`src/modules/supabase/menu-scan.ts`) depois do dono
  conferir. A foto é comprimida (`compressImageForUpload`, WebP ≤ 800px) antes de
  sair do aparelho — reduz o token de imagem (custo) e o envio.

- **Modelo atual: anual (R$ 199,99) OU diária de 24h (R$ 1,99), comprável em
  pacote.** A diária vive em `store_day_passes` (livro-razão, `mp_payment_id`
  UNIQUE → webhook idempotente) e é concedida só pela RPC SECURITY DEFINER
  `grant_day_pass(p_store, p_mp_payment_id, p_amount_cents, p_source,
  p_quantity)` — EXECUTE só para a service role. O dono não tem EXECUTE nem
  INSERT: se o acesso fosse gravável no cliente, bastaria um INSERT para liberar
  a loja de graça.
- **Comprar várias diárias empilha.** `grant_day_pass` soma `quantity × 24h`
  sobre o `unlocked_until` vigente (comprar 2 diárias com 5h restantes → 53h).
  Sem isso, uma segunda compra durante o período ativo desperdiçaria o restante.
  O preço é recalculado no servidor (`api.payment.day-pass.ts`), que recebe só
  `{ storeId, quantity }` — nunca o valor. A reentrega do mesmo pagamento não
  estende de novo (idempotência por `mp_payment_id`).
- Checkout da diária: `POST /api/payment/day-pass` (rota
  `src/routes/api.payment.day-pass.ts`). Exige `Authorization: Bearer <token>` e
  confirma a posse do `storeId` via RLS do próprio usuário, como o create-link.
  Envia `metadata.kind = 'day_pass'` + `metadata.quantity`; a concessão só
  acontece no webhook. O webhook e o sync (`mp-subscription.ts`) leem
  `quantity` do metadata e repassam à RPC.
- **A diária é uma das três opções de plano, no mesmo seletor.** `PlanOptions`
  (componente local de `admin.assinatura.tsx`) junta **Diária (24h)**, **Mensal**
  e **Anual** num único seletor de pílulas; o preço, a nota e o CTA acompanham a
  escolha (`BILLING_OPTIONS`/`BILLING_NOTE`/`BILLING_BUTTON`, tipo
  `BillingOption`). Antes a diária vivia num rodapé à parte ("Prefere só hoje?")
  e parecia um extra escondido; o mensal/anual eram as únicas opções de plano.
  `openPayment` desvia para o checkout da diária quando `billing === "day"` — a
  diária não é assinatura recorrente. O seletor aparece nos DOIS estados
  (convite do plano gratuito e "diária em vigor"); comprar durante o período
  ativo é suportado de propósito (`grant_day_pass` soma as horas). O passo
  "Quantas diárias?" só aparece com a diária selecionada.
- **Pedido de nota fiscal (NFS-e).** O app não emite nota: `invoice_requests`
  (`supabase/supabase_invoice_migration.sql`) é a fila em que o dono PEDE a nota
  e o fornecedor emite. O dono só insere/lê os próprios pedidos
  (`is_restaurant_owner`); o trigger `guard_invoice_requests` (SECURITY INVOKER)
  força `status='pending'` e anula `amount_cents` para quem não é service role —
  sem ele um `PATCH status='emitted'` tirava o pedido da fila sem nota. O
  `requested_by` usa `COALESCE(auth.uid(), NEW.requested_by)`: a rota grava com
  service role, onde `auth.uid()` é NULL, e o carimbo que ela já resolveu não
  pode ser sobrescrito por NULL (a auditoria ficava vazia). A
  validação (CPF/CNPJ módulo 11, e-mail) vive em `src/lib/invoice.ts`; o acesso
  em `src/modules/supabase/invoice.ts` degrada em silêncio sem a migração (como
  `reviews.ts`). A UI é a aba "nota" do hub de assinatura.
- **A nota é pedida DEPOIS da compra, quando o dono quiser** (não é checkbox no
  checkout). O pedido é registrado na fila e o fornecedor é avisado por e-mail.
- **Entrega por e-mail.** `createInvoiceRequest` chama `POST /api/invoice/request`
  (rota `api.invoice.request.ts`) em vez de inserir direto: é lá que a posse da
  loja é confirmada com o RLS do usuário, os dados são revalidados e o aviso sai
  por `src/api/lib/email.ts` (API HTTP do Resend, sem dependência nova). Envs
  server-only: `RESEND_API_KEY` (sem ela o registro vale e o e-mail é pulado com
  log), `EMAIL_FROM`, `INVOICE_NOTIFY_EMAIL` (padrão = `COMPANY.supportEmail`).
  O pedido **já está gravado** quando o e-mail é tentado: falha de e-mail não
  desfaz o registro — a rota devolve `notified:false` e a UI avisa em vez de
  prometer a entrega. Sem a rota (deploy antigo), o cliente cai no insert direto.
- **A nota fiscal é obrigação legal, mas não é upsell — e por isso fica
  discreta.** A ação mora na aba "Nota fiscal" (atalho neutro no fim do hub,
  mesmo peso visual dos outros `GuideTile`); o cartão de estado do plano e a
  aba "Pedidos e detalhes" não repetem o bloco de nota. Fica atrás de
  `!invoicesUnavailable` para não aparecer num banco sem a migração.
- Recompensas concedem **diárias** (créditos), não pedidos bônus: ver
  `supabase_day_pass_rewards_migration.sql` (`store_day_credits`,
  `reward_grants.day_credits`, `rewards.day_credits`). `redeemDayPass` troca 1
  crédito por 24h sem passar pelo Mercado Pago.
- **Preços e env.** `src/lib/pricing.ts` é a fonte única: `PREMIUM_PRICE_VALUE`
  (anual) e `DAY_PASS_PRICE_VALUE` (diária, padrão 1.99), configuráveis por
  `VITE_ANNUAL_PRICE_VALUE` / `VITE_DAY_PASS_PRICE_VALUE` (+ `..._LABEL` para o
  rótulo). Nomes legados `VITE_PREMIUM_PRICE_VALUE` /
  `VITE_PREMIUM_ANNUAL_PRICE` continuam aceitos para o anual. **São `VITE_*`:
  entram no bundle no momento do BUILD**, então mudar o valor exige um novo
  deploy — trocar a env no painel não recompila o que já está no ar.
- **Pagamento pontual exige `/v1/payments/{id}`.** O endpoint sem o `/v1`
  responde **404** e o webhook devolvia 200 com `payment not found` — o
  pagamento aprovado nunca virava Premium e o MP não reentregava. Vale para
  `payments/search` também. Preapproval continua em `/preapproval/...` (sem v1).
  O webhook trata `payment` (id do pagamento) e `merchant_order` (id da ordem,
  cujo pagamento aprovado vem dentro de `payments[]`).
- O sync manual (`syncSubscriptionForEmail`) procura **preapproval e depois
  pagamento pontual** pelo `external_reference` — antes só olhava assinatura e
  nunca achava o Pix/cartão.
- **`MERCADOPAGO_WEBHOOK_SECRET` é a assinatura secreta do webhook, não o Client
  Secret.** O Client Secret (o que autentica em `/oauth/token`) assina diferente
  e faz o MP receber 401 — o painel mostra "0% de notificações entregues" e
  "401 - Com erro". A chave certa está em **Suas integrações → Webhooks →
  Configurar notificação** (64 hex). Trocar essa env exige redeploy: env
  alterada não entra em deploy já existente.
- Preço único: `PREMIUM_PRICE_LABEL` em `src/lib/pricing.ts` (R$ 199,99/ano).
  Fica fora de `modules/supabase` de propósito: a landing precisa exibir o preço
  sem arrastar o cliente Supabase para o bundle público. `subscription.ts`
  reexporta para compatibilidade — ao mudar o preço, mude só lá.
- Landing (`src/routes/index.tsx`) tem uma demo viva (`LiveMenuDemo`): o
  visitante monta um pedido de verdade na própria página, sem backend. É
  marketing interativo, não um fluxo de pedido real — não conecta em nada. O
  cardápio-modelo é o da própria Variant (`DEMO_CATEGORIES`/`DEMO_ITEMS`, com
  abas de categoria), não um exemplo genérico.
- **Simulador "quanto você está perdendo?"** (`LossSimulator`, `#simulador`): o
  dono informa o que paga hoje e os dias de movimento; o sistema recomenda o
  plano (diária ou Premium) e mostra a economia no ano. O ponto de virada é
  `DAY_PASS_BREAK_EVEN = ceil(PREMIUM_PRICE_VALUE / 12 / DAY_PASS_PRICE_VALUE)`:
  acima dele o Premium sai mais barato que a diária todo dia. Os preços vêm de
  `@/lib/pricing` — nunca hardcode. CTA leva a `/login?mode=register` ("conta
  grátis, sem cartão"). Coberto por `smoke-routes.spec.ts`.
- **Identidade da Variant** (`VARIANT` em `src/lib/company.ts`): fonte única da
  missão (reduzir a mortalidade das pequenas empresas cortando gasto
  operacional). A seção `#variant` e o rodapé leem daí — não duplique o texto.
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
  a lista e põem o CTA "Assinar Premium agora · R$ 199,99/ano" (link
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
  `registerPendingSubscription` grava o novo.
- **O Mercado Pago identifica o pagador pelo e-mail.** O login é por telefone
  (pseudo-e-mail `telefone@menufacil.local`), que o MP nunca usa — então o
  vínculo automático só funciona com um e-mail real. `profiles.email` é
  opcional e guarda esse endereço; `registerPendingSubscription` passa a
  receber o e-mail real (`currentEmail || user.email`) em vez do pseudo. Sem
  ele, a ativação automática pode falhar e o dono depende do "Conferir agora".
  Não volte a gravar o pseudo-e-mail interno como `admin_email`.
- **Salvar o e-mail exige garantir a linha de `profiles`.** `updateProfileEmail`
  chamava `UPDATE profiles ... WHERE id = user.id` direto; se a linha não existir
  (contas legadas importadas de `admin_trials`, ou cadastros em que o insert do
  perfil falhou por RLS com a confirmação de e-mail ligada), o UPDATE acerta
  **zero linhas e devolve `{ error: null }`** — a UI mostrava "E-mail salvo!" e o
  campo voltava a "pendente" no próximo carregamento. `ensureProfileRow` faz
  `select`→`insert` (logado, quando a policy `WITH CHECK (auth.uid() = id)` já
  passa) antes do UPDATE; `updateProfileName` usa o mesmo guard. Nunca volte a
  fazer só o `UPDATE` — sem linha, ele falha em silêncio.
- `/admin/assinatura` é um **hub de uma tela só**: seletor de período (diária /
  mensal / anual) + preço + CTA e os atalhos (o que muda, pedidos/detalhes, nota
  fiscal). Cada assunto abre num painel de tela cheia por cima (`Sheet`, Radix),
  que rola por dentro — a página de fundo não cresce. Antes tudo ficava
  empilhado numa coluna longa e era preciso rolar para achar o botão. Mantenha o
  CTA e os atalhos no primeiro bloco, e não traga conteúdo novo para o fluxo da
  página.
- **O e-mail do MP não é um atalho solto** — vive dentro de "Pedidos e
  detalhes", junto da cota e da renovação. Ele era um tile próprio com selo
  "pendente" âmbar competindo com o CTA; agora é um bloco dentro do painel (com
  selo "salvo"/"pendente" discreto) e o `GuideTile` de detalhes anuncia "Cota,
  renovação e e-mail". Não o promova de volta a atalho.
- O **selo de plano** (`src/modules/premium/PlanBadge.tsx`) fica no cabeçalho de
  toda tela autenticada, ao lado do botão de menu: "Grátis" com a cota
  (`restantes/limite`) em tom neutro, ou "Premium" dourado com brilho e os dias
  até vencer. Toca e vai para `/admin/assinatura`. O status vem do
  `PlanProvider` (`src/modules/premium/plan-context.tsx`), montado **fora** do
  `AppLayout` (o selo vive no header, que é irmão do conteúdo) — uma consulta
  por layout, deduplicada por 30s, revalidada ao voltar para a aba e a cada
  5min. Não chame `checkSubscriptionStatus` direto na tela: cada tela repetiria
  a consulta. A tela de assinatura chama `refresh()` do contexto quando o sync
  libera o Premium, para o selo virar sem esperar o ciclo.
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
  checkout via `registerPendingSubscription`. O aviso orienta o usuário a usar
  o **mesmo e-mail da conta do Mercado Pago** — e o pseudo-e-mail interno
  (`...@menufacil.local`) nunca aparece na UI nem é gravado.
- Fallback do webhook: `POST /api/subscription/sync` (rota
  `api.subscription.sync.ts`) busca o preapproval direto na API do MP. Exige
  token de sessão e só age se o e-mail do pagador bater com o registrado na
  linha — evita ativar o Premium de terceiros. A página `/admin/assinatura`
  usa esse sync automaticamente: depois que o dono abre o checkout, ao voltar
  para a aba (visibilitychange + poll de 6s) o status é conferido sozinho e o
  Premium é liberado sem recarregar. O link "Conferir agora" é o fallback
  manual.
- `/admin/assinatura` é organizada em torno de UM único bloco (plano + ação):
  o CTA "Assinar por R$ 199,99/ano" abre o Mercado Pago direto no clique. O
  modal só aparece quando o `window.open` é barrado (popup blocker) — antes o
  modal era um passo obrigatório. O vínculo continua por e-mail/telefone
  (pseudo-email `telefone@menufacil.local`), por isso o aviso fala em
  "telefone" e nunca expõe o endereço interno.
- **A assinatura do Premium é RECORRENTE (preapproval), não pagamento pontual.**
  `POST /api/payment/subscribe` cria um preapproval no Mercado Pago
  (`createPreapproval`/`buildPreapprovalBody` em `src/api/lib/mp-payment.ts`):
  mensal = `frequency 1`, anual = `frequency 12`. Antes o CTA criava um link
  pontual de 30 dias/1 ano, que **não renovava** — quando o dono esquecia de
  recomprar, a loja bloqueava sozinha. O webhook já tratava `preapproval`
  (`processPreapprovalById` → `applyPreapproval`), só faltava quem criasse a
  assinatura. `buildPreapprovalBody` é pura e tem teste próprio
  (`mp-payment.test.ts`): é o contrato com o MP que, se errado, cobra o valor
  errado ou não cobra.
- **Cancelar avisa o Mercado Pago.** `POST /api/subscription/cancel`
  (`cancelPreapproval` = PUT status `cancelled`) roda ANTES de limpar o acesso
  local. `cancelPremium` (cliente) só limpa o banco local — se fosse ele no
  botão, o cartão continuaria sendo cobrado todo mês. `cancelSubscription`
  chama a rota e só cai no local quando não há preapproval (Premium por diária
  ou pagamento pontual). Se o MP recusar o cancelamento, a rota devolve 502 e
  **não** limpa o acesso: melhor o dono continuar Premium por um ciclo do que
  ficar pagando por um acesso que já perdeu.
- `createMonthlyLink` foi removida (código morto: o CTA passou a usar
  `createSubscriptionLink`). `POST /api/payment/monthly` e
  `POST /api/payment/create-link` continuam existindo como caminho pontual,
  mas a UI não os usa mais.

## Segurança e confiabilidade (não regredir)

- **Defesa em camadas contra abuso/flood.** Nenhuma camada sozinha segura:
  - *Borda (Cloudflare):* DDoS volumétrico e bot são absorvidos pela rede/CDN da
    Cloudflare (mitigação automática em qualquer plano). Regras de WAF/firewall
    customizado e "Attack Challenge" são recursos pagos — no plano atual a API
    devolve 402. Se o ataque for dirigido, é aí que se contrata (ou se coloca
    Cloudflare na frente).
  - *Aplicação:* `src/api/lib/rate-limit.ts` limita requisições por IP nas rotas
    de API (`checkRateLimit` + `tooManyRequests`, 429 com `Retry-After`). É em
    memória: **por instância** e efêmero em serverless, então é melhor-esforço.
    Teto por rota: 10/min (links de pagamento), 20/min (sync), 120/min (webhook).
  - *Navegador:* honeypot + tempo mínimo de preenchimento (`src/lib/antispam.ts`,
    usado no `CheckoutModal`). Burlável por um cliente malicioso — é ruído para
    bots comuns, não barreira de segurança. No E2E a regra de tempo desliga
    (`VITE_E2E=1`) porque o preenchimento é instantâneo; o honeypot continua.
  - *Banco:* `create_order_atomic` recusa mais de 5 pedidos do mesmo telefone em
    10 min (conta só os não cancelados). É o bloqueio que realmente conta, porque
    a RPC é o único caminho de escrita de pedido.
- Nunca confie só no cliente para bloquear: qualquer check em JS é contornável.
  O que vale é o que está no servidor/banco.
- **Preço é do servidor.** `createOrder` ignora `unit_price`/`total` do cliente e
  recalcula tudo em `resolveOrderPricing` (`src/modules/supabase/pricing.ts`) a
  partir de `products`, `product_addons` e `delivery_neighborhoods`. O cliente só
  manda `product_id`, `quantity`, `addon_ids` e `notes`. Adicional de outro
  restaurante é descartado; item indisponível/inexistente vira `PricingError`
  (`code: "PRICING"`) — o `Cardapio` mostra essa mensagem ao cliente, o resto
  vira texto genérico. Coberto por `pricing.test.ts`.
- O match de bairro é feito em JS (case-insensitive exato), **nunca** com
  `ilike`: um `%` enviado pelo cliente casaria com qualquer bairro.
- **`admin_trials` não é mais pública.** A policy `public_all_admin_trials`
  (FOR ALL TO anon) permitia a qualquer visitante `PATCH is_premium = true`. Agora
  as policies são só para o dono (join `restaurants.owner_id = auth.uid()`), o
  GRANT para `anon` foi removido e os acessos que precisavam de outra identidade
  usam RPCs SECURITY DEFINER: `legacy_trials_for_owner()` (import legado por
  e-mail/telefone) e `find_store_by_payer_email()` (webhook). O webhook precisa de
  `SUPABASE_SERVICE_ROLE_KEY` para escrever (RLS não se aplica à service role).
- `POST /api/payment/create-link` exige `Authorization: Bearer <token>` e confirma
  a posse do `storeId` via cliente Supabase com o RLS do próprio usuário — sem
  isso qualquer um geraria cobranças para a loja de terceiros.
- `login?returnTo=` passa por `safeInternalPath` (`src/lib/utils.ts`): só caminhos
  internos (`/...`), nunca `//host` ou `https://...`. Coberto por `utils.test.ts`.
- Erros de render do root têm boundary em pt-BR; a página SSR
  (`src/lib/error-page.ts`) também é pt-BR.
- Timers de "pedido novo" (realce de 15–20s) são rastreados e limpos no unmount
  em `useOwnerOrders.ts` e `OrderManager.tsx` — sem isso o `setState` dispara em
  componente desmontado.
- O `runSync` de `/admin/assinatura` chama `POST /api/subscription/sync` (não só
  relê o status local); era por isso que "Conferir agora" não destravava o Premium
  quando o webhook atrasava.
- `SUPABASE_SERVICE_ROLE_KEY` / `MERCADOPAGO_ACCESS_TOKEN` são server-only. Nunca
  prefixar com `VITE_` (vai para o bundle) e nunca deixar valor real no
  `.env.example`.
- **Cota do plano gratuito é derivada de `orders`, não de um contador.** Com
  `admin_trials` restrita ao dono/webhook, `monthly_order_count` deixou de subir
  (o cliente não pode mais escrever) e o limite de 5 pedidos/mês sumia. Agora
  `get_order_for_owner`, `owner_locked_stores` e `owner_monthly_order_count`
  contam os pedidos REAIS do mês (`status <> 'cancelled'`). É consistente e à
  prova de adulteração; não reintroduza o contador no cliente.
- Ativação do Premium usa `upsert` (não `update`): um UPDATE sem linha não gera
  erro, então o webhook devolvia 200 e o pagamento ficava "perdido". O webhook
  ainda confere `activated.length` e devolve 500 para o MP reentregar.
- Um trigger `guard_admin_trials_premium` (SECURITY INVOKER — se fosse DEFINER
  `current_user` viraria o owner e o guard sempre passaria) bloqueia
  `is_premium`/`premium_expires_at`/`mercadopago_preapproval_id` para quem não é
  service role. Sem ele, o dono dava `PATCH is_premium=true` na própria linha e
  burlava o pagamento. O dono só pode **desligar** (botão cancelar, que também
  limpa a data); ligar e escrever o vencimento é só o webhook (service role).
  `premium_expires_at` era o buraco mais barato: sem a proteção bastava um
  `PATCH premium_expires_at='2099-01-01'` para virar Premium perpétuo.
- **Sem data de vencimento não há Premium.** As três checagens
  (`get_order_for_owner`, `owner_locked_stores` e `premiumActive` no cliente)
  exigem `premium_expires_at IS NOT NULL AND > now()`. A regra antiga
  (`IS NULL` = sem prazo) transformava qualquer linha malformada — ou o
  `createTrial` legado, que gravava `is_premium: true` sem data — em assinatura
  perpétua. É fail-closed de propósito: o webhook sempre grava a data.
- `supabase/supabase_premium_guard_migration.sql` aplica só este endurecimento
  (guard + as três RPCs) e é idempotente. Foi criado porque a produção estava
  atrás do repositório: sem trigger e com as RPCs antigas contando
  `monthly_order_count` (que o dono edita) em vez dos pedidos reais do mês.
  Use-o para bancos que não receberam o `schema.sql` completo.
- `order_status_history`: o cliente só pode inserir a entrada inicial `received`
  (policy `WITH CHECK (status = 'received')`) e só lê histórico de loja
  publicada. Antes qualquer anônimo podia forjar "entregue"/"cancelado" e ler
  histórico de pedido de terceiros.
- Avaliação só é aceita se o `order_id` pertencer ao `restaurant_id`
  (`order_belongs_to_restaurant`, SECURITY DEFINER em
  `supabase_reviews_migration.sql`) — antes dava para avaliar pedido de outra loja.
- Edge Function `notify-new-order` valida que o `id` do pedido existe e pertence
  ao `restaurant_id` antes de enviar push (endpoint público com a anon key).
- Tabelas legadas `chat_messages`/`game_sessions`/`game_moves` não são mais
  `FOR ALL TO anon`; ficam para `authenticated` (não são usadas pelo app).
- `src/start.ts` injeta cabeçalhos de segurança (HSTS, X-Frame-Options,
  nosniff, Referrer-Policy, Permissions-Policy e CSP de enquadramento) em
  produção; em dev ficam de fora para não quebrar http.
- Se um `id` de pedido (`orders.id`, UUID) vaza, o histórico/status fica exposto
  por design (link de acompanhamento). É um ponto em aberto: não aumente a
  superfície logando o id em analytics/URLs de terceiros.


## Painel (admin)

- **O plano gratuito dá 1 restaurante por conta; criar mais é Premium.** O gate
  vive no BANCO: o trigger `guard_restaurant_limit` (`supabase/supabase_restaurant_limit_migration.sql`,
  BEFORE INSERT em `restaurants`) conta os restaurantes do dono e recusa o
  segundo quando não há Premium vigente. A policy `owner_insert` só exige
  `owner_id = auth.uid()`, então um INSERT direto via PostgREST criaria quantos
  quisesse — a UI sozinha seria contornável. Premium é a MESMA definição de
  `get_order_for_owner`/`owner_locked_stores`: `is_premium` E
  `premium_expires_at > now()` em QUALQUER loja do dono (`owner_has_premium_access`).
  A **diária de 24h NÃO libera multi-loja** de propósito (ela dá pedidos
  ilimitados, não várias lojas). A UI (`admin.restaurantes.tsx`) lê a RPC
  aditiva `owner_restaurant_limit()` e, quando o dono já tem loja e não é
  Premium, abre o `RestaurantLimitDialog` com o CTA de assinatura em vez do
  formulário; se o INSERT escapar (Premium expirou entre a leitura e a escrita)
  o erro do trigger também cai no diálogo. Não mova essa checagem só para o
  cliente: o que vale é o trigger.
- **Loja ativa é única e global** (`src/modules/store/active-store-context.tsx`).
  O `ActiveStoreProvider` vive acima das rotas em `admin.tsx`, carrega os
  restaurantes uma vez e expõe `active`/`activeId`/`setActiveId`/`reload`. Antes
  cada tela escolhia a própria loja (`data[0]`, estado local ou filtro "todas"),
  então trocar de loja no dashboard não mudava Pedidos nem Financeiro — o dono
  via números de lojas diferentes na mesma sessão. Toda tela nova lê
  `useActiveStore()` em vez de recarregar a lista. O mobile
  (`store-context.tsx`) segue a mesma escolha via `readStoredStoreId`, para as
  duas telas não divergirem.
- A escolha vive em `localStorage` (`cidadela:active-store`, helpers em
  `active-store-storage.ts`) e é validada contra a lista: se a loja lembrada não
  existir mais, cai na primeira. É por dispositivo, não por conta.
- `StoreSwitcher` (cabeçalho) é o único lugar de troca; só renderiza com mais
  de uma loja. Não reintroduza um seletor por tela (o dashboard tinha pílulas e
  o Compartilhar tinha um `Select`) — era a mesma decisão em dois lugares, com
  risco de divergirem. O Financeiro é a exceção deliberada: mantém um filtro
  local com a opção "Todos" (visão consolidada), mas escolher uma loja ali
  também muda a loja ativa global.
- A sidebar separa **Operar loja** (Dashboard, Pedidos, Financeiro,
  Compartilhar) de **Conta** (Restaurantes, Assinatura) — a grade de
  restaurantes e o botão "Criar restaurante" vivem só na aba Restaurantes; o
  dashboard não repete os mesmos cards.
- O dashboard não tem mais um seletor de loja nem a grade "Seus restaurantes":
  a troca está no cabeçalho e a grade na aba Restaurantes.

- O fundo do painel é um céu vivo em `<canvas>`: `SpaceBackdrop`
  (`src/components/shared/SpaceBackdrop.tsx`), montado uma vez no `AppLayout`
  (vale para admin e mobile). Estrelas com paralaxe + repulsão suave no
  ponteiro, cometas/meteoros cruzando, e raro um planeta ou uma nave; toque
  solta faíscas. Sem imagem nem rede, `pointer-events-none` e atrás do conteúdo
  (`z-0` no canvas, `z-10` no wrapper) para não roubar cliques. Desliga com
  `prefers-reduced-motion` (um quadro estático) e pausa com a aba oculta.
- O Dashboard não repete o nome da loja: o `PageHeader` mostra só "Dashboard"
  e o nome vive no `StorePulseBar`. O seletor de restaurante só aparece com
  mais de uma loja (pills); com uma só virava ruído.
- KPI "Restaurantes" saiu do topo (a seção "Seus restaurantes" já cobre) e o
  "hoje" ficou no título da seção, não em cada rótulo.
- Assinante **não** vê o `PremiumUsageMeter` no meio do dashboard — o estado
  Premium já aparece no `PlanBadge` do topo. O termômetro é só para o plano
  gratuito/diária (convite ao upgrade).
- A faixa `StorePulseBar` (`src/components/admin/StorePulseBar.tsx`) fica no topo
  do dashboard com o pulso do dia em uma linha: aberto agora / fechado / pausado
  (relógio de 60s, sem recarregar) e as ações que o dono mais repete — pausar,
  copiar o link e abrir a gestão. Reusa `handleTogglePublish`, não cria regra nova.
- O estado vazio do dashboard é um guia de 3 passos (criar → montar → publicar),
  não só um botão solto.
- `isOpenNow` (`src/lib/operatingHours.ts`) checa só hoje e ontem (madrugada),
  em vez de varrer os 7 dias a cada render. Coberto por
  `src/lib/operatingHours.test.ts`.
- Login (`src/routes/login.tsx`) lembra o último telefone digitado em
  `localStorage` (`cidadela:last-phone`) para não redigitar o DDD quando a sessão
  expira. É conveniência, não credencial — a senha nunca é guardada.

## MATA-FOME: retenção e imagens leves

- O sistema guarda só o que sustenta a operação (restaurante, cardápio,
  contador de cota). Pedido antigo e dado de cliente final são descartáveis.
  `supabase/supabase_retention.sql` (rodar uma vez no SQL Editor) cria
  `cleanup_old_data(30)` + dois jobs `pg_cron`: limpeza diária (03:00 UTC) e
  reset do contador mensal. `order_items`/`order_status_history` caem por
  `ON DELETE CASCADE`; `admin_trials` **nunca** é apagada.
- **Conta sem atividade há 30 dias é apagada por inteiro.**
  `supabase/supabase_inactive_accounts_migration.sql` (idempotente) adiciona
  `profiles.last_seen_at` e agenda o job `mata-fome-inactive-accounts`
  (pg_cron, 04:00 UTC). A RPC `purge_inactive_accounts(30, false)` apaga
  restaurantes (cascata em cardápio/pedidos) → perfil → `auth.users`. O que
  mantém a conta viva (basta UM sinal recente): o dono abrir o painel
  (`last_seen_at`, via `touch_last_seen()` chamado pelo `usePresencePing`),
  receber pedido (`orders.created_at`) ou a loja ficar online
  (`store_usage.day`). **Premium vigente nunca é apagado** — quem pagou não
  perde a conta por inatividade. A tela de Configurações mostra o aviso lendo
  `account_purge_status()` (some sem a migração). É fail-safe: sem o job, nada
  é apagado. `delete_own_account()` continua sendo a exclusão a pedido.
  **Pegadinha:** `admin_trials.store_id` é `varchar` (legado) e `restaurants.id`
  é `uuid` — a checagem de Premium precisa de `t.store_id::uuid`, senão o job
  estoura com "operator does not exist: uuid = character varying" e falha toda
  noite. `supabase/run-sql.mjs` executa um `.sql` avulso via Management API
  (faxinas pontuais, no padrão do `apply-all.mjs`).
- **Produto não tem mais foto — só um tile genérico.** O cardápio público, o
  carrinho e o painel renderizam o mesmo bloco (`UtensilsCrossed` na cor de
  destaque / 🍔 no carrinho) em vez de `item.image_url`. A coluna
  `products.image_url` continua no banco (dado existente, e o admin ainda a
  carrega ao editar um produto para não apagá-la), mas saiu do payload público
  (`PRODUCT_COLUMNS`). Motivo: a foto por produto era ~2 MB por cardápio de 30
  itens e o **maior consumidor de egress do Supabase** — com o plano grátis
  (~10 GB) isso limitava o app a ~3–5 lojas. Tirar a foto empurra o teto para
  dezenas de lojas sem custo. Não reintroduza o campo de upload de foto no
  `MenuManager` (`ImageField` foi removido; logo/capa seguem no
  `RestaurantDialog`). Se a foto por produto voltar um dia, ela tem de vir por
  um host sem egress cobrado (R2), não do Supabase Storage.
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

## Modo Cozinha (fila de pedidos)

- `src/components/admin/KitchenMode.tsx` é a fila linear em tela cheia: um
  pedido por vez, o mais antigo primeiro, itens em letra grande e um botão que
  nomeia a ação ("Começar preparo", "Marcar pronto") em vez do status. Existe
  porque o Kanban empilha quatro colunas no celular apoiado na bancada.
- É aberto pelo `OrderManager` (botão no cabeçalho) e pelo cabeçalho do
  `/mobile`. Recebe `orders` já filtrados, `lockedStores`, `restaurantNames` e
  `multi`; as ações (`onAdvance`/`onCancel`) são as mesmas do Kanban — não
  duplica regra de transição.
- Respeita o bloqueio do plano: com a loja bloqueada os itens **não** são
  renderizados (o `getOrdersByRestaurant` traz `order_items`, então esconder é
  responsabilidade da tela) e as ações somem. Coberto por
  `KitchenMode.test.tsx` (ordem da fila, avanço, bloqueio).
- Usa `orderTimer`/`formatElapsed` de `@/modules/mobile/orders` e tem relógio
  próprio (15s) para o "tempo parado" não congelar. `Escape` fecha; o scroll do
  painel atrás é travado enquanto o overlay está aberto.

## Fila de pedidos com volume (não poluir a tela)

- `src/modules/ui/ProgressiveList.tsx` mostra os `initial` primeiros itens e
  resume o resto em "Ver mais N" (lotes de `step`, com "Mostrar menos" para
  recolher). Os itens escondidos **não são montados**, então 40 pedidos não
  custam 40 cards na primeira pintura. É o primitivo para qualquer lista longa.
- O `/mobile` (`mobile.index.tsx`) usa `initial={2} step={8}` sobre
  `visibleOrders`; o Kanban do `OrderManager` usa o mesmo em cada coluna ativa e
  no histórico. Assim um dia cheio não vira uma parede de cards nem rolagem
  infinita — a tela fica estável e o operador abre só o que precisa.
- O `data-testid="progressive-more"` existe para o E2E medir o resumo. Coberto
  por `ProgressiveList.test.tsx` (só 2 montados, revela em lotes, recolhe, sem
  controles quando cabe).
- O E2E `e2e/orders-queue.spec.ts` prova com 40 pedidos: só 2 cards no DOM,
  botão "+38", 10 após um toque. Para telas autenticadas o stub aceita uma
  sessão logada via `window.__E2E_SESSION__` (o `getSession`/`getUser` do stub
  a devolvem); sem ela o E2E continua anônimo como antes.

## Recompensas: pedidos bônus por engajamento (sem desconto)

- Em vez de cupom de desconto, a loja que usa o sistema ganha **pedidos a mais
  na cota** do mês. A cota efetiva é `5 (grátis) + bônus do mês`. Nada toca o
  Mercado Pago — é tudo Supabase, e o preço segue intocado.
- Migração única: `supabase/supabase_rewards_migration.sql` (idempotente).
  Cria `store_bonus_orders` (saldo), `store_usage` (tempo online por dia),
  `rewards` (metas), `reward_grants` (dedupe por mês) e as RPCs
  `bump_store_usage`, `owner_bonus_orders`, `owner_usage_seconds`,
  `owner_rewards`, `evaluate_rewards`; recria `get_order_for_owner` e
  `owner_locked_stores` com `5 + bônus`; agenda `evaluate_rewards` no `pg_cron`
  (de hora em hora) e semeia as metas padrão (20h online → +5; 1.000 pedidos →
  +20).
- **O bônus nunca é gravável pelo cliente.** Vive em `store_bonus_orders`, com
  RLS só de leitura para o dono; quem concede é o cron (SECURITY DEFINER). Se
  ficasse em `admin_trials` (que o dono edita), bastava um `PATCH bonus=9999`
  para furar o limite. Não reintroduza escrita de bônus no cliente.
- A cota recalculada está no servidor, dentro das mesmas RPCs de bloqueio. O
  `SubscriptionStatus` ganhou `bonusOrders` e `monthlyLimit = 5 + bonus`; o
  `toStatus` (`subscription.ts`) já cobre isso. `PremiumUsageMeter` e a tela de
  assinatura mostram o bônus; `RewardsProgress` mostra as metas e o progresso.
- **Tempo online conta só com a loja aberta.** `useStoreUsage`
  (`src/modules/mobile/useStoreUsage.ts`) manda um batimento de 60s enquanto o
  painel está visível **e** `isOpenNow(operating_hours)` é verdadeiro — é o
  "tempo online da loja", não a aba do dono fora de hora. O servidor limita a
  120s por chamada (anti-inflação). Está ligado no `MobileStoreProvider` e no
  layout `/admin`.
- Push ao dono: Edge Function `notify-reward` (reaproveita `push_vapid` +
  `push_subscriptions`). O cron chama via `pg_net`; sem `app_settings`
  (`functions_base_url`) o bônus ainda é concedido, só não sai o push. As RPCs
  são aditivas: sem a migração, `owner_bonus_orders` devolve 0 e tudo segue na
  cota padrão — nada trava.
- Coberto por `subscription.test.ts` (cota+bônus), `rewards.test.ts` (RPCs),
  `RewardsProgress.test.tsx` e o E2E `premium-flow.spec.ts` ("pedidos bônus
  elevam a cota e destravam os detalhes").

## Banco de dados: aplicar as migrações

- **Projeto Supabase: `wlznmlsvnlgsljanbjgy`** (região `us-west-2`, nome
  "Cardapio"). É o ref que o bundle de produção usa
  (`https://wlznmlsvnlgsljanbjgy.supabase.co`). O `GOOGLE_AUTH_SETUP.md` cita um
  ref antigo (`hkzhksauilonqppipjyc`) e este arquivo já citou
  `xfgmnggdgnozyrluqabv` — ambos desatualizados; confirme pelo bundle em caso de
  dúvida.
- **Estado do banco de produção (verificado em 2026-11-03):** alinhado com o
  repositório. As **36** tabelas existem com RLS ligado; todas as RPCs
  (`create_order_atomic`, `get_order_for_owner`, `owner_locked_stores`,
  `grant_day_pass`, `evaluate_rewards`, `bump_store_usage`, `redeem_day_pass`,
  `find_store_by_payer_email`, `legacy_trials_for_owner`, ...) estão presentes e
  todas as chamadas `.rpc()` do código têm função correspondente; os guards
  `trg_guard_admin_trials_premium` e `trg_guard_invoice_requests` são SECURITY
  INVOKER (`guard_admin_trials_premium`/`guard_invoice_requests` com
  `prosecdef=false`) e `store_is_unlocked` exige `premium_expires_at > now()`;
  os três jobs `pg_cron` (`cidadela-rewards`, `mata-fome-cleanup`,
  `mata-fome-reset-monthly`) estão ativos. Se um banco novo for criado, rode
  `apply-all.mjs`.
- **`invoice_requests` aplicada em produção**: RLS ligado, policies
  só de INSERT/SELECT para o dono, trigger `trg_guard_invoice_requests` ativo,
  `anon` sem grant, `guard_invoice_requests` SECURITY INVOKER. Se um banco novo
  for criado, a migração já está na ordem do `apply-all.mjs`.
- **Grants de push endurecidos** (`supabase_push_grants_migration.sql`):
  `push_vapid` (chave privada VAPID) e `push_subscriptions` vinham com o grant
  default do Supabase (ALL) para `anon`. O RLS já barrava (não há policy para
  anon), mas o REVOKE é a segunda camada — o mesmo raciocínio do `admin_trials`.
  O fluxo de push não depende do grant de anon: a inscrição é feita logado e a
  chave pública chega pela Edge Function `push-vapid-key` (service_role).
- **As Edge Functions estão deployadas** (verificado em 2026-11-03):
  `push-vapid-key`, `notify-new-order`, `notify-reward` e `webpush-probe` existem
  no projeto e `push_vapid` já tem a chave. O push de pedido novo/recompensa
  depende do deploy continuar de pé — se um banco/projeto novo for criado, rode
  `supabase functions deploy <slug> --project-ref wlznmlsvnlgsljanbjgy` (exige
  `--yes`/confirmação e os secrets `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`,
  `VAPID_SUBJECT`). Sem isso, `push_vapid` fica vazio e nada é enviado — o app
  não quebra, só não notifica.
- `supabase/apply-all.mjs` aplica **todas** as migrações na ordem correta via
  Management API (sem Docker, sem conexão direta ao Postgres — o host
  `db.<ref>.supabase.co` é IPv6-only e não resolve neste ambiente). Uso:
  `SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node supabase/apply-all.mjs`
  (`DRY_RUN=1` só lista os arquivos). Ordem: `schema.sql` → loyalty → reviews →
  rewards → retention. O token vai por env var, nunca por argumento.
- **Ordem de bootstrap no `schema.sql`.** Algumas funções (`get_order_for_owner`,
  `owner_locked_stores`) referenciam `admin_trials`, que só é criada mais
  adiante. O arquivo abre com `SET check_function_bodies = off` (como o
  `pg_dump`) para o Postgres não validar o corpo na criação. Não remova esse
  `SET` nem reordene as funções para depois das tabelas sem testar num banco
  vazio — é o que quebra o bootstrap do zero.
- **Tabelas legadas precisam de `ENABLE ROW LEVEL SECURITY`.** `chat_messages`,
  `game_sessions` e `game_moves` têm policies `TO authenticated` mas, sem o
  `ENABLE`, o grant default do Supabase deixa o **anon** ler/gravar/apagar tudo.
  O schema agora faz `ENABLE` + `REVOKE ... FROM anon` nelas.
- **Defesa em profundidade nos grants.** Além do RLS, o schema revoga o grant
  default do `anon` em `admin_trials`, `app_settings`, `store_bonus_orders`,
  `store_usage`, `rewards` e `reward_grants` (o `anon` só mantém o que tem
  policy pública: catálogo, `orders`/`order_status_history`/`cidadela_unlocks`/
  `reviews`/`order_tracking`). Não reintroduza grants amplos para `anon` nessas
  tabelas — era por aí que um visitante sem login escrevia em `admin_trials`.
- **Views precisam de `security_invoker = true`.** Diferente do RLS (que só vale
  para tabelas), uma view sem esse atributo roda com as permissões do **dono da
  view** e ignora o RLS por completo. `admin_restaurant_summary` e
  `admin_today_orders` estavam assim, e com o grant default de `anon` um
  visitante anônimo (chave `anon`, pública) lia **todos** os restaurantes — nome,
  `owner_id` e contagens — inclusive os não publicados. Ambas agora têm
  `security_invoker = true` e o `anon` foi revogado. Ao criar uma view nova que
  leia tabela com RLS, declare o atributo e não dê grant ao `anon` sem intenção.
- Verificação rápida após aplicar: todas as tabelas `public` com
  `relrowsecurity = true`; `evaluate_rewards()` roda sem erro; o job
  `cidadela-rewards` (`10 * * * *`) está ativo em `cron.job`.

## Áreas de toque no celular (WCAG 2.5.5)

- O dono opera o painel no celular, muitas vezes com a mão suja ou na correria.
  Alvos pequenos erram o toque. O utilitário `hit-area` (`src/styles.css`) estende
  a área clicável para **44px** via um `::after` invisível centrado, **sem inchar o
  desenho** — o visual compacto continua igual. Vale só em `@media (pointer: coarse)`,
  então no mouse o alvo continua o do desenho e não rouba o clique do vizinho.
- **Não aplicar em botões colados** (steppers −/+, abas com `gap` pequeno): as áreas
  expandidas se sobrepõem e o toque dispara a ação errada. Nesses casos, aumente o
  desenho com folga (ex.: stepper da diária em `size-9` com `gap-1.5`).
- Alvos que já usam `hit-area`: botão "+" do cardápio público, hambúrguer de
  `AppHeader`/`mobile`, `PlanBadge`, ícones do `StorePulseBar`, "Voltar" do
  restaurante, "?" do `FinanceSummary`, "Abrir cardápio público" do card, "✕" do
  `GuidePanel`.

## Custos, limites e quando migrar para o Pro

Números verificados em **2026-11-03** (supabase.com/pricing,
developers.cloudflare.com). Reconfira antes de decidir — os planos mudam.

**Limites do plano gratuito (o que morde):**
- Supabase: **5 GB de egress de origem + 5 GB de egress em cache** (dois baldes
  separados, não um só), 500 MB de banco, 1 GB de Storage, 50.000 MAUs,
  200 conexões de realtime simultâneas, 2M mensagens/mês, 500k invocações de
  Edge Function, **pausa após 7 dias sem uso**, 2 projetos ativos, sem backup.
  Com a imagem no R2, o egress de origem é só o JSON — ver "Efeito do R2".
- Cloudflare Pages: **estático é grátis e ilimitado** (HTML/CSS/JS/imagens não
  contam); só as **Functions** (SSR e rotas de API) consomem a cota, que é a do
  Workers Free: **100.000 invocações/dia** (compartilhada com Workers), 10 ms de
  CPU por invocação, 50 subrequests por chamada, 500 builds/mês. Zera 00:00 UTC.
  No teto, o dinâmico para (erro 1027) até o reset; o estático continua.
- Mercado Pago: Pix 0,99%; cartão 3,99% (30 dias) a 4,98% (na hora). Use ~3,5%
  como taxa média no mix Pix + cartão.
- Resend: 3.000 e-mails/mês.
- Cloudflare Workers AI: **10.000 Neurons/dia** grátis (zera 00:00 UTC);
  excedente US$ 0,011/1.000 Neurons (só no Workers Paid — no free é teto rígido).
  Llama 3.1-8B gasta ~4.119 Neurons por 1M tokens de entrada e ~34.868 por 1M de
  saída. Neste app a IA só roda ao criar/editar loja ou pedir suporte: **centenas
  de conversas/dia cabem no grátis**, e no volume atual o custo é R$ 0,00.

**Manutenção do banco — automatizada pelo cron `cidadela-vacuum-*`.**
A retenção (`cleanup_old_data`) apaga pedidos todo dia às 03:00; no Postgres o
`DELETE` **não devolve espaço** ao sistema, então o banco crescia sozinho e o
bloat se acumulava. Medido em 2026-11-03: **140 MB com 10 pedidos** — a tabela
`orders` tinha 24 kB de dados e um índice de 13 MB. Um `VACUUM FULL` derrubou
para 16 MB. Agora três jobs semanais (`cidadela-vacuum-orders|items|history`,
domingo 04:00 UTC, `supabase_maintenance_migration.sql`) rodam `VACUUM
(ANALYZE)` e mantêm o tamanho estável sem intervenção. **Um job por tabela**:
o pg_cron envolve o comando numa transação e recusa `VACUUM` multi-statement.
`supabase/maintenance.sql` (VACUUM FULL) fica para quando o banco já estiver
inchado e você quiser devolver o espaço ao disco de uma vez — é manual porque
trava a tabela.

**Consumo medido por loja/mês** (do código, não chute): cardápio público
~15 MB; painel do dono ~14 MB (carga limitada a 300 pedidos + poll leve de
45s). Total **~30 MB (loja leve) a ~250 MB (loja pesada)**.

Medido no projeto real em 2026-11-03: **11.047 requisições REST na semana** com
11 lojas de teste, e o cardápio de uma loja (produtos + categorias + addons +
restaurante) pesa **12,3 KB**. Ou seja: a 5 GB de egress/mês cabem ~400.000
aberturas de cardápio — o egress não é o problema; a pausa é.

**Gatilhos de migração** (o primeiro que bater manda):

| Gatilho | Limite | ~Quando |
| --- | --- | --- |
| Egress | 5 GB/mês (use 4 GB como alarme) | 20–40 lojas ativas |
| Realtime | 200 conexões simultâneas | ~40 lojas (só donos; cliente virou poll) |
| Banco | 500 MB | ~40 lojas (rode `VACUUM FULL` para não inchar) |
| Cloudflare Functions | 100k/dia | ~400 lojas |
| **Pausa de 7 dias** | — | contornada pelo keep-alive (grátis) |

**O gatilho real é a pausa, não o egress.** Um projeto pausado derruba o app
(503) até restaurar à mão. O `scripts/keep-alive.mjs` (workflow a cada 5 dias)
contorna isso **de graça**: uma requisição leve, sem token, e o projeto nunca
fica 7 dias parado. Enquanto o keep-alive rodar, a pausa não acontece.

👉 **Não migre por ter cliente pagando. Migre quando a RECEITA pagar o Pro.**
O Pro custa ~US$ 25 ≈ R$ 137/mês. Com Premium mensal a R$ 28,99, isso é
**~5 assinantes** (5 × R$ 28,99 ≈ R$ 145). Antes disso, o Pro é prejuízo:
com 1 assinante (R$ 28,99) e o Pro (R$ 137), você perde R$ 108/mês. Os outros
limites (egress 5 GB, banco 500 MB, realtime 200) estão a centenas de lojas de
distância — não são motivo para migrar agora.

**Enquanto a receita não paga o Pro:** keep-alive ligado + os jobs
`cidadela-vacuum-*` cobrem a operação no plano grátis, sem intervenção manual.

## Contabilidade (medida em 2026-11-03)

**Custo fixo mensal (existir, mesmo sem vender):**

| Item | Valor |
| --- | --- |
| DAS do MEI (serviços) | R$ 86,05 |
| Domínio | R$ 3,33 |
| Supabase free + Cloudflare | R$ 0,00 |
| IA (Cloudflare Workers AI, free) | R$ 0,00 |
| **Total** | **R$ 89,38/mês** |

Mais: taxa do Mercado Pago de **3,5%** sobre tudo que entra (Pix 0,99%;
cartão 3,99–4,98%). Quando migrar, o Pro soma **R$ 137/mês**.

**Líquido por venda (já com a taxa do MP):** Premium mensal R$ 27,98 ·
Premium anual R$ 16,08/mês · diária R$ 1,92.

**20 lojas:**

| Cenário | Bruto/mês | Líquido (free) | Líquido (Pro) |
| --- | --- | --- | --- |
| Todos grátis | R$ 0,00 | −R$ 89,38 | −R$ 226,38 |
| 10 grátis + 5 diária + 5 Premium | R$ 212,23 | **R$ 115,42** | −R$ 21,58 |
| 5 grátis + 5 diária + 10 Premium | R$ 344,85 | **R$ 243,40** | R$ 106,40 |
| 15 mensal + 5 anual (otimista) | R$ 518,18 | **R$ 410,66** | R$ 273,66 |

Recomputado em 2026-11-03 com os preços do código (`src/lib/pricing.ts`): anual
**R$ 199,99**, mensal **R$ 28,99**, diária **R$ 1,99**. Atenção: material antigo
citava a diária a R$ 1,49 — está desatualizado, o valor vigente é R$ 1,99. A
diária do cenário supõe 8 dias de movimento/mês por cliente.

**O gatilho de gasto é o Pro (R$ 137/mês), e só ele.** No free, os 20 lojas dos
cenários acima rodam com **infra R$ 0,00** — o custo fixo é só MEI + domínio
(R$ 89,38). Migrar para o Pro antes da receita cobrir vira prejuízo: com 5
Premium (R$ 115,42 líquido) o Pro deixa o mês **negativo em R$ 21,58**. Migre
quando o líquido free passar de R$ 137/mês de forma recorrente — ou seja, **a
partir do cenário de 10 Premium**. Até lá, keep-alive + os jobs de VACUUM
seguram a operação no grátis.

**A IA não muda a conta.** O Workers AI dá 10.000 Neurons/dia grátis — com o
Llama 3.1-8B isso é ~centenas de conversas de suporte ou extrações por dia, e a
IA só roda ao criar/editar loja ou pedir ajuda (não é por pedido nem por visita).
No volume de 20 lojas o gasto é **R$ 0,00**; o teto diário só apertaria em uso
muito acima disso, e aí o excedente é US$ 0,011/1.000 Neurons (~R$ 0,06 por
1.000 Neurons). O chat de suporte reduz o custo humano, não o de infra.

**Teto da diária (15/mês):** 15 × R$ 1,99 = R$ 29,85 — acima do Premium mensal
(R$ 28,99). É de propósito: no teto, o Premium vira a opção mais barata, então o
limite empurra o cliente de uso intenso para a assinatura em vez de deixá-lo
pagar diária todo dia.

**Ponto de equilíbrio:** no free, **4 assinantes mensais** cobrem os R$ 89,38.
No Pro, **9 assinantes** cobrem os R$ 226,38. O Pro se paga sozinho com
**5 assinantes mensais** (5 × R$ 27,98 = R$ 139,88 > R$ 137).

**Projeção de 12 meses** (conversão lenta: 3 meses só diária, 3 com 5 Premium,
6 com 10 Premium): bruto R$ 2.944,59, **líquido R$ 1.768,97 → média
R$ 147,41/mês**. Os 3 primeiros meses fecham no **vermelho** (só diária não
cobre o custo fixo), e o ano vira no mês 4.

**Receita média por loja ativa** (mix 30% Premium + 30% diária ×8 dias + 40%
grátis): **R$ 13,47/mês** bruto (R$ 13,00 líquido). É esse número que
dimensiona a meta — para R$ 1.000/mês líquido são **~77 lojas ativas**, para
R$ 2.000, ~154.

**A diária é isca, não sustento.** 5 clientes × 8 dias = R$ 76,81 líquido,
abaixo dos R$ 89,38 de custo fixo. Sozinha, dá prejuízo. O negócio vive do
Premium — a diária existe para converter quem tem movimento esporádico.

**Teto do MEI: R$ 81.000/ano.** São **233 Premium mensais** para estourar —
muito longe. O MEI aguenta o ano inteiro; só perto do teto vale falar com o
contador sobre virar ME.

**O que a conta do "lucro 100%" esquece:**
- **Taxa do Mercado Pago:** ~3,5% do bruto. Sobre R$ 518,18 são ~R$ 18/mês.
- **DAS do MEI:** R$ 82,05–87,05/mês, sempre, mesmo sem faturar. É o custo fixo
  real de existir formalizado — some na conta de quem só olha "infra grátis".
- **Enquadramento:** o CNAE do MEI hoje é de vestuário (4781400), não de
  software. Faturar SaaS nesse CNAE é risco de glosa. Ver "Identidade legal e
  fiscal" abaixo — nada disso se resolve em código.

## Efeito do R2 no teto do plano gratuito

Com a imagem no R2 (egress zero), o egress do Supabase passa a ser só o JSON das
consultas. Números reais medidos em 2026-11-04:

| Cenário | Payload/visita | Egress Supabase | Visitas frias/mês no free |
| --- | --- | --- | --- |
| Antes (imagem no Supabase, banner 24 kB) | ~31 kB | 5 GB | **~161 mil** |
| Depois (imagem no R2, só JSON) | ~6,6 kB | 5 GB | **~758 mil** |

O R2 multiplica o teto por **~4,7×** — e a imagem ainda ganha o cache de borda
da Cloudflare (a maioria das visitas nem chega ao R2). Em número de lojas: uma
loja com ~100 visitas/dia consome ~0,2 GB/mês de egress; o free aguenta
**~25 lojas ativas** só pelo egress do Supabase (antes eram ~5). Com o cache de
borda e o SWR de 6h do cardápio (a maioria das visitas é quente, não bate no
banco), o teto prático é maior.

**R2 grátis:** 10 GB de storage, 1M escritas (Class A) e 10M leituras (Class B)
por mês, egress zero. Cada upload é 1 Class A; cada leitura que escapa do cache
é 1 Class B. Com 20 lojas e ~100 fotos por loja, são ~2.000 uploads e, mesmo sem
cache, ~10M leituras — no teto, mas o cache de borda (MISS → HIT) faz a maioria
das leituras não chegar ao R2. **Custo: R$ 0,00.**

**Quando o free aperta:** o primeiro teto a estourar deixa de ser a imagem
(resolvido) e passa a ser o **egress do JSON do Supabase** (~758 mil visitas
frias/mês) ou, em volume muito alto, as **leituras Class B do R2** (10M/mês).
Nenhum dos dois chega perto com dezenas de lojas. Só vale migrar para o Pro
(R$ 137/mês) quando o egress do Supabase passar de 5 GB/mês de forma recorrente —
o que, com o payload enxuto, é ~750 mil visitas frias/mês.

## IA (Cloudflare Workers AI)

- **Duas funções, um token só.** `CLOUDFLARE_AI_TOKEN` (server-only) habilita:
  (1) transformar o texto livre do dono em campos do formulário de restaurante e
  (2) o chat de suporte. O cliente vive em `src/api/lib/ai.ts`, que chama a API
  REST do Workers AI (`/accounts/{id}/ai/run/{model}`, modelo
  `llama-3.1-8b-instruct`) — **não** o binding `env.AI`, que não chega ao
  handler no Pages via Nitro.
- **A IA é opcional em tudo.** Sem o token, `runAi` devolve `null` e quem chama
  cai no fallback: o formulário usa a extração determinística
  (`parseRestaurantText`) e o chat devolve um texto-guia com o e-mail de suporte.
  Nada quebra, nada trava — só perde o "entender texto livre".
- **A visão vai DENTRO de `messages`.** O modelo de visão
  (`llama-3.2-11b-vision-instruct`) recusa `image` como campo de topo:
  `AiError 3030: Unable to add image when there are no user-supplied nor
  system-supplied messages`. O formato aceito é a imagem no `content` da
  mensagem, como `image_url` (`buildVisionBody` em `ai.ts`, com teste próprio).
  Com o campo errado a foto falhava mesmo com o token certo — devolvia
  `scan_failed`. O modelo de visão também exige aceitar a licença da Meta UMA
  vez por conta (`POST {model}` com `{"prompt":"agree"}`); sem isso devolve
  `AiError 5016 Model Agreement`. Já aceito na conta de produção.
- **⚠️ O `CLOUDFLARE_AI_TOKEN` gravado no Pages foi revogado (2026-11-04).** O
  token que estava nas env (`cfut_56ud…`) passou a devolver `10000
  Authentication error` em `/ai/run`, então **foto e chat de IA estão desligados
  agora** (caem no fallback: parser determinístico / texto-guia — nada quebra).
  Para religar: incluir `Workers AI → Read` no token e regravar com
  `wrangler pages secret put CLOUDFLARE_AI_TOKEN`. O token atual do projeto
  (`cfut_06LI…`) tem Pages + DNS, mas **não** Workers AI.
- **Custo é irrelevante neste volume.** O Workers AI tem cota diária gratuita e
  só é chamado quando o dono cria/edita a loja ou pede ajuda — não é por pedido
  nem por visita. Centenas de conversas/dia cabem no gratuito.
- **A IA nunca escreve no banco.** `extractRestaurantFields` só SUGERE valores
  que preenchem o formulário (só campos vazios — nunca sobrescreve o que o dono
  digitou). Quem salva é o `createRestaurant` de sempre. E a heurística
  determinística tem prioridade sobre o modelo: é previsível e não alucina.
- `extractJson` recorta do primeiro `{` ao último `}` antes de parsear: o
  modelo às vezes cerca o JSON de prosa mesmo instruído a devolver só o objeto.
- Rotas: `POST /api/restaurant/extract` (só sugere) e `POST /api/support/chat`
  (responde E encaminha o relato por e-mail via Resend). As duas exigem
  `Authorization: Bearer` — endpoint com custo de IA não pode ficar aberto.
- **O Pracinha também monta o pedido do CLIENTE (texto → carrinho).** No
  cardápio público, o botão "Pedir por texto" (na barra de categorias) abre
  `src/components/cardapio/PracinhaOrderChat.tsx`: o cliente escreve "2 x-burger
  sem cebola e um guaraná" e as linhas entram no carrinho de sempre.
  - `POST /api/order/draft` (`api.order.draft.ts`) recebe `{ restaurantId, text }`,
    carrega produtos/adicionais disponíveis do restaurante e devolve
    `{ lines, unmatched, ai, reply }`.
  - **A IA NUNCA define preço.** Ela só devolve `product_id`/`quantity`/`addon_ids`/
    `notes`; `reconcileOrderDraft` descarta qualquer id fora do catálogo e limita
    a quantidade a 50. O preço segue sendo recalculado pela RPC
    `create_order_atomic` — uma alucinação não muda quanto o cliente paga.
  - `parseOrderDeterministic` (`src/api/lib/order-draft.ts`) roda SEMPRE e casa
    por nome (token + prefixo, sem acento), quantidade (número ou por extenso) e
    observações ("sem cebola"); a IA só entra para sinônimos, e sem
    `CLOUDFLARE_AI_TOKEN` o recurso continua funcionando. Coberto por
    `order-draft.test.ts` (inclui o teste de que nenhuma linha traz preço).
  - O componente não escreve no carrinho direto: devolve as linhas por `onAdd`,
    e o `Cardapio` aplica com o `addToCart` de sempre.
  - **É recurso PREMIUM (não inclui a diária).** O gate REAL é no servidor:
    `POST /api/order/draft` checa `isStorePremium` (`src/api/lib/premium.ts`,
    `is_premium` + `premium_expires_at > now()`) e devolve **403** para loja sem
    Premium. O botão só é mostrado quando a RPC pública `store_is_premium`
    (`supabase_garcom_premium_migration.sql`, também no fim do `schema.sql`)
    devolve `true` — o cardápio é anônimo e não enxerga `admin_trials`; a RPC
    devolve SÓ um booleano. Se a RPC faltar (banco antigo), o botão fica
    escondido e nada quebra. Coberto pelo E2E `public-menu.spec.ts`
    ("loja grátis não vê 'Pedir por texto'").
  - **Fallback offline.** O parser determinístico vive em `src/lib/order-draft.ts`
    (client-safe) e roda no NAVEGADOR quando a rota não responde (offline/deploy
    antigo), usando o cardápio já carregado. `api/lib/order-draft.ts` só tem o
    prompt/leitura da IA e reexporta o resto. Um 403 (sem Premium) NÃO cai no
    fallback — é recusa intencional do servidor. O E2E prova o fallback
    abortando a rota.

- **O Pracinha é a identidade do suporte.** Nome em homenagem aos pracinhas da
  FEB (1944-45); ele se apresenta como **colaborador da Variant**, não como
  "robô". O system prompt está em `api.support.chat.ts` — mantenha esse tom.
- O chat (`src/components/support/SupportChat.tsx`) é aberto pelo botão
  "Suporte" no rodapé do sidebar do admin. Ele responde na hora e, **quando o
  caso é escalado**, o relato vai por e-mail para `INVOICE_NOTIFY_EMAIL`
  (best-effort: sem `RESEND_API_KEY` a resposta sai, só o e-mail não).
- **Escalação em dois gatilhos:** a IA termina a resposta com `[ESCALAR]` (a
  marca é removida do texto exibido) **ou** o dono toca "Enviar para o time".
  O e-mail só sai na escalação — mandar a cada mensagem gastaria a cota do
  Resend (3.000/mês) com conversa fiada.
- **O e-mail termina com o PROMPT PARA O DEV.** `src/api/lib/dev-report.ts`
  monta o relato (loja, conta, página, dispositivo, conversa/stack) e o bloco
  que você copia e cola no OpenHands para corrigir. É determinístico — não
  depende de uma segunda chamada de IA para existir.
- **A IA não lê o repositório — ela não "vê o código".** O que ela faz é capturar
  o relato + o contexto e transformar num prompt que um agente COM acesso ao
  código executa. Não prometa "a IA conserta sozinha" na UI.
- **Erro de código também vira relato.** `src/lib/reportError.ts` (cliente) é
  chamado pelo error boundary do root e pelos listeners globais
  (`unhandledrejection`/`error`); `src/api/lib/server-error-report.ts` cobre
  SSR/rotas de API, ligado no `errorMiddleware` de `src/start.ts`. A rota
  `POST /api/support/error` monta o mesmo relato com stack e prompt.
  - Dedupe por mensagem em janela de 10 min (mapa por isolate, melhor-esforço)
    — sem isso um erro em loop viraria centenas de e-mails.
  - O reporte de servidor só roda com `NODE_ENV=production`; o dev local não
    dispara e-mail.
  - `reportError` nunca lança e nunca bloqueia a tela.

## Deploy (Cloudflare Pages)

- **Alvo é Cloudflare Pages, não Vercel.** O plano Hobby da Vercel restringe uso
  a projetos pessoais não-comerciais, e um SaaS por assinatura é uso comercial —
  o deploy podia ser pausado. O build sai em `dist/` (`_worker.js` + `assets/`)
  via `nitro.config.ts` com `preset: "cloudflare-pages"`. `vercel.json` não
  existe mais.
- Projeto Pages: `cardapio-cidadela` (account `5123773a9dbba0599ba001539d5c3cbe`),
  servindo `cardapio.pracinha.online` (CNAME → `cardapio-cidadela.pages.dev`,
  proxied). O domínio vive no Cloudflare, na mesma zona `pracinha.online`.
- **Auto-deploy no push da `main`**: `.github/workflows/deploy-cloudflare.yml`
  roda `npm ci` → `npm run build` → `wrangler pages deploy dist`. As `VITE_*`
  vêm dos secrets do repositório (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
  — entram no bundle no BUILD, então mudá-las exige novo deploy.
- O workflow instala **npm 11** antes do `npm ci`: o Node 22 traz npm 10, que
  recusa o lock gerado pelo npm 11 (`Missing: lru-cache@... from lock file`).
- `nodejs_compat` já vem no `wrangler.json` gerado pelo Nitro — sem ele o
  `process.env` das rotas de API (`readEnv`) não existe e a cobrança quebra.
- Secrets de runtime (server-only, não `VITE_*`) vivem no projeto Pages, não no
  workflow: `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`,
  `MERCADOPAGO_WEBHOOK_SECRET`, `RESEND_API_KEY`. Sem eles o app sobe e degrada
  em silêncio; o webhook do MP é o que exige o service role.
- **O canal de e-mail está LIGADO e testado (2026-11-04).** Env do Pages:
  `RESEND_API_KEY`, `EMAIL_FROM=Cardápio Cidadela
  <no-reply@cardapio.pracinha.online>` e `INVOICE_NOTIFY_EMAIL=variantfeb@gmail.com`.
  Um POST de teste em `/api/support/error` devolve `{"ok":true}` e o Resend
  registra `delivered` para `variantfeb@gmail.com`. Suporte, erro automático e
  pedido de nota chegam.
- **O domínio `cardapio.pracinha.online` está verificado no Resend.** São 3
  registros na zona `pracinha.online` (TXT `resend._domainkey.cardapio` + CNAME
  `rsend.cardapio` e `send.cardapio`, ambos **DNS only**). Com o domínio
  verificado dá para enviar de `no-reply@cardapio.pracinha.online` para
  **qualquer** destinatário; sem ele o Resend só entrega para o dono da conta
  (`403 validation_error`). Se um dia recriar o domínio, o `EMAIL_FROM` precisa
  acompanhar o novo endereço.
- **O token da Cloudflare precisa das 3 permissões certas, e elas não são
  óbvias.** Para este projeto o token tem que ter:
  - `Cloudflare Pages` → **Edit** (deploy);
  - `DNS` → **Edit** na zona `pracinha.online` (criar registros). **Não** é
    `Configurações de DNS` (`zone_dns_settings`) — essa só mexe em SOA/TTL/modo
    e o `POST /dns_records` continua dando `10000`;
  - `Workers AI` → **Read** (foto/chat).
  Sem `Zone Read` o `GET /zones` devolve lista vazia mesmo com o DNS liberado —
  não use esse endpoint para concluir que o DNS não funciona; teste direto em
  `GET /zones/{zone_id}/dns_records` com o `zone_tag` que vem do domínio Pages.
- **Dois tokens da Cloudflare, papéis diferentes.** `CLOUDFLARE_API_TOKEN`
  (secret do GitHub) é o de DEPLOY: precisa de **Cloudflare Pages: Edit** (a
  permissão `Pages Read` só vê o projeto e o deploy falha com
  `Authentication error [code: 10000]`). `CLOUDFLARE_AI_TOKEN` é o de RUNTIME:
  só **Workers AI: Read**, e vive nas env do Pages. Confundir os dois foi o que
  deixou o deploy quebrado sem ninguém perceber (o site continuou no ar servindo
  o último build bom).
- **Gravar uma env do Pages sem apagar as outras.** O `PATCH` de
  `deployment_configs.production.env_vars` **substitui o mapa inteiro**, e a
  leitura não devolve o valor das secrets. Use
  `wrangler pages secret put <NOME> --project-name=cardapio-cidadela` — mexe só
  na chave pedida. O workflow `.github/workflows/set-pages-secret.yml` faz isso
  para o `CLOUDFLARE_AI_TOKEN`.
- **Armadilha de runtime:** `src/lib/error-capture.ts` é importado no servidor e
  registrava listeners do navegador (`error`/`unhandledrejection` com
  `useCapture`). O runtime do Workers rejeita o 3º argumento de
  `addEventListener` ("useCapture must be false") e derruba o SSR inteiro. O
  bloco agora exige `typeof window !== "undefined"`.
- O token de API da Cloudflare precisa de **DNS: Zona → Editar** + **Cloudflare
  Pages: Conta → Editar**, com **Zone Resources → Include → pracinha.online**.
  Sem o "Zone Resources" o token lista 0 zonas e tudo responde "Authentication
  error", mesmo com as permissões certas.
- **A URL do webhook no painel do Mercado Pago precisa ser a do domínio
  canônico**: `https://cardapio.pracinha.online/api/webhook/mercadopago`. Ela
  ficou apontada para `cardapio-cidadela.vercel.app` por muito tempo, que agora
  devolve 404 (o build é alvo Cloudflare), então o MP notificava no vazio e a
  loja nunca liberava sozinha. Trocar de host exige reeditar o painel: a config
  de webhook do MP **não** é acessível pela API (`/v1/webhooks` responde
  `resource not found`).
- O `PATCH` de `deployment_configs.production.env_vars` no Pages **substitui o
  mapa inteiro**, não faz merge — ao adicionar uma secret, reenvie o conjunto
  completo (as `plain_text` somem se você mandar só a nova).

## Backup dos dados (Supabase → Cloudflare R2)

- **O Supabase free não tem backup automático.** A rede de segurança é o
  workflow `.github/workflows/backup-r2.yml`, que roda todo dia às 03:30 UTC e
  exporta as tabelas do app para o bucket R2 `cardapio-cidadela-backups` (10 GB
  grátis, na conta Cloudflare do projeto). Os scripts são
  `scripts/backup-to-r2.mjs` e `scripts/restore-from-r2.mjs`
  (`npm run backup` / `npm run restore`); a documentação completa, com os
  secrets e o passo a passo de recuperação, está em **`scripts/BACKUP.md`**.
- **O workflow precisa do secret `SUPABASE_SERVICE_ROLE_KEY`** (Settings →
  Secrets), que o deploy **não** usa — sem ele o backup falha. O
  `CLOUDFLARE_API_TOKEN` existente precisa da permissão **Workers R2: Edit**.
- **O dump tem dados de clientes: o bucket é privado.** Não crie domínio
  público nem `r2.dev` para ele. O restore é upsert por `id` (não apaga nada),
  mas rode primeiro sem `--confirm` para ver o plano.
- Fotos **não** entram no dump (ficam no Storage e são re-baixáveis); o que é
  salvo é o **cardápio** e o **estado de assinatura/saldos**, que são o que dói
  perder. O dump é texto compactado (dezenas de KB).
- **Retenção: 3 dias.** O bucket guarda hoje + ontem + anteontem; o R2 apaga o
  resto sozinho pela lifecycle rule `expire-old`, reaplicada pelo workflow a
  cada execução (`scripts/r2-lifecycle.mjs`, idempotente). Para mudar o número
  de dias, veja `scripts/BACKUP.md` (seção Retenção).

## Domínio, acompanhamento e performance do cardápio

- **A vitrine da landing é o cardápio REAL da Variant, não um mock.** O
  `LiveMenuDemo` (`src/routes/index.tsx`) começa com um snapshot estático
  (`DEMO_SNAPSHOT`) e logo troca pelos dados de `getLandingDemoStore()`
  (`src/modules/supabase/landing-demo.ts`), que lê a loja `dona-da-pensao` por
  slug. Trocar a foto, o preço ou um item no painel muda a home sozinha — sem
  deploy. Os botões "Ver cardápio real" apontam para `/cardapio/dona-da-pensao`
  (a mesma loja), então a vitrine e o cardápio público mostram a mesma coisa. O
  snapshot existe só para não piscar em branco antes da resposta; se o banco
  falhar, ele segura a página. A área de itens tem altura fixa com rolagem
  interna: sem isso, uma categoria com 5 itens estourava o hub da landing (o
  E2E `smoke-routes.spec.ts` mede `scrollHeight - clientHeight <= 4`).
- **O link compartilhado usa o domínio canônico, não o host do navegador.**
  `currentOrigin()` (`src/lib/site.ts`) devolve `SITE_URL`
  (`cardapio.pracinha.online`) em produção e só mantém a origem local quando ela
  é `localhost`/`127.0.0.1` (dev). Antes devolvia `window.location.origin`, então
  quem abrisse o painel pelo `*.pages.dev` compartilhava o endereço do provedor.
  `SharePanel` e `StorePulseBar` usam isso; o `/mobile` tem um botão de
  compartilhar (Web Share API com fallback para copiar/WhatsApp).
- **O cliente acompanha por polling, sem realtime.** O `/pedido/$orderId` e o
  `/meus-pedidos` **não abrem WebSocket**. O realtime no lado do cliente custava
  **uma conexão por telefone aberto**, e o plano free limita a 200 conexões
  simultâneas: com 20 lojas e ~10 clientes esperando por loja ao mesmo tempo,
  batia no teto (20 donos + 200 clientes = 220) e as conexões novas eram
  recusadas. Agora o poll de 20s é o único caminho — 0 conexões persistentes,
  e a mudança de status aparece em até 20s (o pedido leva ~20 min, então a
  diferença é imperceptível). A RPC `get_order_tracking` só devolve colunas
  públicas, então o poll não expõe nada a mais. O ciclo **para quando o pedido
  fecha** (entregue/cancelado não muda mais). Não reintroduza `subscribeToOrders`
  nessas duas telas — o dono continua com realtime (poucas conexões), mas o
  cliente multiplica por telefone.
- **Alerta que não pode falhar.** `useOwnerPendingOrders` (o sino/contador do
  mobile) mantém um `Set` de ids conhecidos: o poll de 15s compara com a lista
  atual e dispara o alerta para o que o realtime não entregou. Também revalida no
  `visibilitychange` — o navegador congela o WebSocket em segundo plano.
- **Índices pré-computados no cardápio público.** `Cardapio.tsx` roda o render a
  cada rolagem (scroll-spy) e a cada 60s (relógio). Por isso `productsByCategory`,
  `availableAddonsByProduct` e `cartQtyByProduct` são `useMemo` com `Map`:
  filtrar `products` por categoria dentro do `.map` (duas vezes) e refazer o
  reduce do carrinho por produto era O(categorias × produtos) por quadro.

- **Cache SWR do cardápio público.** `src/modules/supabase/menuCache.ts` guarda
  o último payload (restaurante + categorias + produtos + bairros + adicionais)
  em `localStorage`, por slug, com TTL de 24h. `Cardapio.tsx` hidrata do cache no
  primeiro paint e revalida em segundo plano; o realtime regrava o cache, então a
  próxima abertura (mesmo offline) já nasce atualizada. É o corte de egress mais
  direto: o segundo acesso do mesmo cliente não consulta o Supabase para montar a
  tela. Sem cache, o comportamento é o de sempre. Ao mudar o formato do payload,
  suba `CACHE_VERSION` (senão o snapshot velho é lido com campos faltando).
- **Imagens do Storage são cache-first no service worker.** `public/sw.js`
  (`VERSION` v3) guarda as fotos do bucket `restaurant-images` numa cache
  separada, com teto de 200 arquivos. As URLs têm timestamp no nome (imutáveis),
  então cache-first é seguro e evita rebaixar a mesma foto a cada visita. Não
  cacheia navegação nem `/api/` — pedido nunca vem de cache velho.
- **Pedidos do dono numa consulta só.** `getOrdersByRestaurants(ids)` faz um
  `.in("restaurant_id", ids)` em vez de uma consulta por loja. Era N+1 no
  `useOwnerOrders` (mobile) e no `OrderManager` (admin), repetido a cada poll de
  15s. A consulta é limitada a `ORDERS_PAGE_LIMIT` (300) pedidos mais recentes —
  sem o teto, o egress crescia com o histórico de 30 dias a cada recarga do
  painel. O poll de segurança usa `getOrderStatusesByRestaurants` (só `id,status`,
  mesmo teto) e só rebaixa os pedidos completos quando algo mudou; ambos ignoram
  a aba escondida. A migração `supabase/supabase_perf_indexes_migration.sql`
  adiciona o índice `(restaurant_id, created_at DESC)` que essas consultas
  ordenadas usam, mais os índices de cardápio, e uma limpeza de imagens órfãs no
  Storage.

## Custos: limites reais e quando migrar

- **Cloudflare Pages (free): o teto é de Function, não de banda.** O site estático
  tem banda ilimitada, mas **todo HTML é renderizado por Worker** (o app é SSR,
  `src/start.ts`), e a Function soma na cota do Workers free: **100.000
  requisições/dia** (e 10 ms de CPU por requisição). Um page view = 1 invocação.
  Logo, o gatilho de custo nº 1 é **~100 mil page views/dia** — muito acima do
  que 20 clientes geram. `/api/*` também é Function.
- **Supabase (free): o teto real é egress (5 GB/mês) e conexões realtime (200).**
  Banco 500 MB, Storage 1 GB. Como a retenção já apaga pedidos > 30 dias, o banco
  não enche; o que enche é tráfego de saída (imagens + JSON do cardápio) e picos
  de conexão. Por isso o cache SWR (egress) e o cache de imagem no SW (egress)
  valem mais que qualquer tuning de banco.
- **Free vs Pro do Supabase.** Pro = US$ 25/mês (≈ R$ 137) e o único motivo
  inegociável para migrar é **uptime + backup**. O projeto free **pausa após
  7 dias sem atividade** — o keep-alive já contorna isso de graça. Então o Pro
  não se paga sozinho: **só migre quando a receita cobrir os R$ 137/mês**
  (~5 assinantes mensais). Antes disso é prejuízo, não investimento.
- **Ordem de gatilhos para migrar:** (1) egress > ~4 GB/mês ou pico realtime
  > ~150 → rever cache antes de pagar; (2) 2º projeto free em uso → consolidar;
  (3) **receita recorrente ≥ R$ 137/mês** (≈ 5 assinantes) → Pro, aí o backup
  diário vira argumento de venda e não custo; (4) 100k page views/dia →
  Workers pago (US$ 5/mês, 10M req).
- **Workers AI (free): 10.000 neurons/dia; a foto do cardápio é barata.** O
  modelo de visão (`@cf/meta/llama-3.2-11b-vision-instruct`, 4.410 neurons/M de
  entrada e 61.493/M de saída) gasta ~100 neurons por leitura → ~100 leituras/dia
  grátis, ~3.000/mês. Acima disso, ~US$ 0,0011 por foto. Ou seja, o gate anual
  da foto é **posicionamento de preço, não economia** — o custo só aparece se o
  recurso virar autoatendimento público em massa. Confirme o número no dashboard
  (Cloudflare → Workers AI), que é onde a cota é medida.
- **Índices redundantes são custo de escrita.** Um índice de coluna única cujo
  prefixo já está num composto não é usado pelo planejador — só custa INSERT/
  UPDATE. `supabase_index_cleanup_migration.sql` remove os que a auditoria de
  produção achou (`idx_orders_store_created` era duplicata exata de
  `idx_orders_restaurant_created`; `idx_orders_restaurant`,
  `idx_categories_restaurant`, `idx_products_restaurant`, `idx_orders_guest`
  eram prefixos cobertos). Ao criar um índice novo, confira se um composto
  existente já atende antes de duplicar.


## Painel: organização da fila de pedidos (UX)

- `OrderManager` (`src/components/admin/OrderManager.tsx`) **não é mais um Kanban
  de quatro colunas**. As colunas ficavam todas abertas ao mesmo tempo e os
  "Recebidos" — a primeira coisa que o operador precisa ver — eram espremidos em
  um quarto da largura. Agora cada status é uma **aba** (`filter`, que inicia em
  `"received"`) e a aba ativa ocupa a tela inteira. A ordem das abas é
  `TAB_ORDER` (Recebidos → Em preparo → Prontos → A caminho → Todos → Entregues →
  Cancelados) e os rótulos vivem em `TAB_LABEL` (plural, minúsculo — não reusa
  `ORDER_STATUS_LABELS`, que é caixa alta de selo).
- A aba renderiza uma **grade compacta** dentro de um container `h-full` com
  `overflow-y-auto`: a página não cresce, a grade rola por dentro. O root do
  `OrderManager` é `flex h-full min-h-0 flex-col` e `admin.pedidos.tsx` repassa
  `h-full` (o `AppLayout` já dá a altura). Não volte a `ProgressiveList` aqui —
  o corte por altura é o que mantém o `main` sem overflow (o E2E mede isso).
- `OrderCard` ganhou `showStatus` (some o selo de status quando a aba já é o
  status) e o bloqueio do plano **não esconde mais o card inteiro**: só a linha
  de itens vira "Itens bloqueados" + convite de assinatura; comanda, cliente,
  horário, valor e ações continuam visíveis. O mesmo vale para o painel de
  detalhes (`OrderDetailDialog`): com `blocked`, mostra cliente/total e só troca
  a lista de itens pelo CTA.
- O detalhe abre num painel largo sobreposto (`DialogContent` com
  `max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] sm:max-w-3xl lg:max-w-4xl`),
  não num diálogo estreito.
- **Hooks antes dos returns.** `tabOrders` (o `useMemo` de ordenação) precisa
  ficar **acima** dos `if (loading…)`/`if (error…)`. Declarar um hook depois de
  um return antecipado faz o React lançar "Rendered more hooks than during the
  previous render" e a rota cai no error boundary.
- **A contagem das abas vem de `tabCounts`, sobre `contextOrders`.** `contextOrders`
  é o filtro de contexto (loja/período/busca) **sem** o status; `displayedOrders`
  é o recorte final com o status ativo. Contar as abas a partir de
  `displayedOrders` zerava todas as outras (o número só "aparecia" ao clicar,
  quando o próprio filtro mudava). Regressão coberta por `OrderManager.test.tsx`
  ("move o número de uma aba para a outra ao avançar o pedido").
- O Dashboard (`admin.index.tsx`) abre com os KPIs de **hoje** (pedidos,
  faturamento, ticket) e o seletor de período (7/30/90 dias) vive junto do
  gráfico, que é o que ele filtra. Não devolva o período para a barra do topo.
- Os gráficos de barra do Financeiro (`admin.financeiro.tsx`) usam
  `maxBarSize={48}`. Com um só dia de dados o recharts estica a única barra para
  a largura toda e ela vira um quadrado azul gigante; o teto de largura a
  mantém um retângulo fino de pé. Regressão coberta por
  `e2e/financeiro.spec.ts`.

## Login: "Criar conta" com sessão ativa

- `/login` aceita `?mode=register`, que abre o formulário já em "Criar conta".
  Os CTAs de criação da landing apontam para lá.
- Quem já está logado e pede `mode=register` **não é mais redirecionado em
  silêncio** para o painel (parecia que o cadastro estava quebrado). O login
  renderiza `AlreadySignedIn`, que mostra a conta atual e oferece "Ir para o meu
  painel" ou "Sair e criar outra conta" (faz `signOut` e volta para
  `?mode=register`). Sem `mode=register`, o redirecionamento direto continua.

## Identidade legal e fiscal (venda do SaaS)

- `src/lib/company.ts` é a **fonte única** dos dados do fornecedor (razão social,
  CNPJ, cidade/UF, regime, canal de suporte). Termos (`terms.tsx`), Privacidade
  (`privacy.tsx`), rodapé da landing (`index.tsx`) e "Sobre o aplicativo"
  (`mobile.config.tsx`) leem de lá — não duplique o CNPJ em JSX.
- CNPJ `65.025.130/0001-24` = `65.025.130 JOHN ADRIAN DA SILVA DO ROSARIO`,
  **MEI**, Florianópolis/SC, situação ATIVA (confirmado na Receita em
  2026-10-31). MEI usa o nome do titular como razão social; não há nome fantasia
  registrado, então a marca exibida continua "Cardápio Cidadela".
- `COMPANY.supportEmail` = `variantfeb@gmail.com`; `COMPANY.supportPhone` segue
  **vazio** (as telas mostram só o e-mail). `hasSupportContact` controla a
  exibição; o telefone, quando preenchido, é só dígitos com DDI (`5548...`).
- `company.test.ts` valida o dígito verificador do CNPJ (módulo 11) e a coerência
  dos campos; o E2E `smoke-routes.spec.ts` exige o CNPJ visível em `/`, `/terms`
  e `/privacy`. Trocar o CNPJ sem atualizar `company.ts` quebra os dois.
- **Não existe emissão de nota fiscal no código** — nem NFS-e, nem NF-e, nem
  integração com prefeitura/SEFAZ. A "comanda" (`buildThermalTicket` em
  `src/lib/utils.ts` + `autoPrint.ts`) é cupom não fiscal da cozinha. Se a venda
  exigir nota do serviço, é integração nova (provedor de NFS-e), não uma flag.
- `COMPANY.fiscal` reúne os dados que a NFS-e exige (logradouro, CEP, código
  IBGE do município, inscrição municipal, CNAE, item da LC 116, alíquota do ISS,
  e-mail) e estão **vazios** de propósito: `missingFiscalFields` lista o que
  falta e a aba "Nota fiscal" da assinatura mostra o que está pendente.
  Preencher **não** liga a emissão — só evita perder o dado quando a integração
  for feita. Não apresente esses campos como "emissão de nota" na UI.
- A aba "Pedidos e detalhes" (`admin.assinatura.tsx`) é só o resumo do plano
  (restaurante, status, limite, renovação). O bloco fiscal (razão social + CNPJ,
  dados pendentes e o caminho para pedir a nota) mora na aba "Nota fiscal" — não
  duplique esse conteúdo aqui.
- **Alerta fiscal:** o CNAE principal do MEI é 4781400 (vestuário) e não há CNAE
  de desenvolvimento de software/serviços de TI. Emitir nota de SaaS nesse
  enquadramento é risco de glosa; o caminho usual é abrir ME (não MEI) com CNAE
  de desenvolvimento (ex.: 6201-5/01, 6202-3/00) ou confirmar com o contador.
  Além disso, MEI tem **teto anual de faturamento** — um SaaS por assinatura
  pode estourar. Nada disso é resolvido em código.
- **Checklist do que só o humano fecha (o código não resolve):**
  1. `COMPANY.supportEmail`/`supportPhone` — hoje vazios; as telas escondem o
     canal, mas vender sem canal de suporte é vender sem suporte.
  2. `COMPANY.fiscal` — hoje vazio; sem ele não há NFS-e possível
     (`missingFiscalFields` lista o que falta).
  3. Enquadramento fiscal (MEI × ME) confirmado com o contador; sem isso a
     emissão de nota é risco, não recurso.
  4. Deploy: as mudanças de identidade legal/cobrança só aparecem em produção
     depois de publicar (o CNPJ não existe no bundle antigo — conferir em
     `/terms`).

## Egress: o teto real do plano gratuito

- **O gargalo é o EGRESS de Storage (5 GB/mês), não o banco nem a Cloudflare.**
  Medido em 2026-11-03: banco 16 MB / 500 MB (3,2%), Storage 1,19 MB / 1 GB
  (0,12%), REST ~1.600 req/dia, auth ~30/dia. Nada disso chega perto do teto —
  o que estoura primeiro é servir imagem grande demais para muita gente.
- **Toda imagem do app deve passar pela URL transformada do Storage**
  (`optimizedImageUrl` / `SmartImage`), nunca o arquivo cru. A transformação
  (`/render/image/`) converte para WebP no tamanho pedido: um banner de 729 kB
  virava 24 kB (**30× menos**). O card do admin (`RestaurantCardCompact`),
  os avatares (`AccountMenu`, `admin.config`, `admin.restaurante.$id`) e o
  cardápio público usam isso; sobrou só `<img>` cru no preview do
  `RestaurantDialog` (arquivo local antes do upload) e nos QR Codes (externos).
- **Fallback obrigatório.** A transformação é recurso pago do Supabase; onde ela
  estiver desligada o `<img>` precisa voltar à URL original (`onError` com
  `data-original`), senão a imagem some. `SmartImage` já faz a cadeia
  transformada → original → jpeg → fallback.
- **`srcset` 1x/2x** (`imageSrcSet`) evita que uma tela retina peça o dobro de
  pixels à toa (logo de 160 pedia 320). Só entra em host do Storage; imagem
  externa passa intacta.
- **Trocar logo/banner apaga o arquivo antigo** (`deleteRestaurantImageByUrl`,
  agora usado no `RestaurantDialog`). A URL é imutável (timestamp no nome),
  então sem isso o bucket só acumulava órfãos. O cron `mata-fome-images`
  (`supabase_perf_indexes_migration.sql` → `cleanup_orphan_images`) limpa o que
  escapar, com janela de 7 dias.
- **Cache do cardápio público é SWR de 6h** (`MENU_CACHE_FRESH_MS`). A
  revalidação (`Cardapio.tsx`) só bate no banco quando o snapshot venceu — antes
  rebatia os quatro payloads a cada 5 min mesmo com o cache fresco, o pior dos
  dois mundos. `getMenuWithProducts` também deduplica consultas em voo por
  restaurante (`inflightMenu`).
- **Preço da cota em número de aberturas.** Payload do menu ~6,6 kB por visita
  fria; com banner WebP de 24 kB, cada visita gasta ~31 kB. Os 5 GB do plano
  gratuito cobrem ~160 mil visitas frias/mês (mais, porque o cache do navegador
  evita a maioria). O que derruba a conta é imagem crua de centenas de kB — aí
  são ~7 mil aberturas e o mês acaba.

## Imagens no Cloudflare R2 (egress zero)

- **Imagem saiu do Supabase Storage e foi para o R2.** O Supabase dá 5 GB/mês de
  egress e imagem é o que mais sai; no R2 o egress é **zero** e o domínio
  público (`images.pracinha.online`, bucket `cardapio-cidadela-images`) é
  *proxied* pela Cloudflare, que cacheia na borda (MISS → HIT, `max-age=14400`).
  A foto é servida do cache sem tocar o R2 nem a cota do Supabase. É o que
  estica o grátis de ~20 para centenas de lojas.
- **O binding `IMAGES` vem do `wrangler.json` da raiz.** O Nitro lê esse arquivo
  e faz merge no config gerado (`defu`); sem declará-lo ali, o
  `wrangler pages deploy` **limpa** o `r2_buckets` do projeto a cada deploy e
  `/api/image/upload` responde 503. Não remova o `r2_buckets` do `wrangler.json`
  nem confie só no painel: o deploy sobrescreve.
- **Como a rota lê o binding:** `request.runtime.cloudflare.env.IMAGES`
  (`getImagesBinding` em `src/api/lib/r2-images.ts`). Testado no runtime do
  Pages (put/get/delete). Sem o binding (dev local, deploy antigo) as rotas
  devolvem 503 e o cliente cai no Supabase Storage — nada quebra.
- **Rotas server-side com posse confirmada.** `POST /api/image/upload` e
  `POST /api/image/delete` exigem `Authorization: Bearer <token>` e confirmam
  que a loja pertence ao usuário pelo RLS do próprio token (como o
  create-link). O delete só age sob o prefixo `<restaurantId>/` — não dá para
  apagar imagem de outra conta. Teto: 30 uploads/min e 60 deletes/min por IP.
- **`storage.ts` tenta o R2 e cai no Storage.** `uploadRestaurantImage` posta em
  `/api/image/upload`; em 503/rota ausente usa o bucket `restaurant-images` de
  sempre. A compressão no navegador (WebP ≤ 800x800, q70) continua antes de
  qualquer envio.
- **Cache imutável.** O nome carrega timestamp, então o `put` no R2 manda
  `Cache-Control: public, max-age=31536000, immutable`; o service worker
  (`cidadela-v4`) também cacheia `images.pracinha.online`.
- **Cache SWR do cardápio é `v2`** (`CACHE_VERSION` em `menuCache.ts`). O bump
  foi necessário porque os clientes guardavam as URLs antigas do Supabase por até
  6h (janela fresca) e não pegariam a migração sozinhos.
- **Migração:** `scripts/migrate-images-to-r2.mjs` (idempotente) copia os objetos
  do Storage para o R2 e reescreve as URLs em `restaurants`/`products`. Rodado em
  produção em 2026-11-04: 7 objetos (~1 MB, loja "Dona da Pensão") movidos e as
  URLs do banco reescritas.
- **Limpeza de órfãos do Storage continua** (`cleanup_orphan_images`), mas agora
  as URLs apontam para o R2, então objetos que ainda existirem no Supabase
  viram órfãos e são removidos na janela de 7 dias. O bucket do Supabase fica
  vazio com o tempo.

## Landing: hub de uma tela (sem rolagem)

- **A home (`src/routes/index.tsx`) não rola.** Herói + atalhos + rodapé cabem na
  viewport; cada assunto (Recursos, Sua marca, Pracinha, Preços, Quem faz,
  Dúvidas) abre num **painel por cima** (`GuidePanel`, o mesmo do
  `/admin/assinatura`) com X para fechar. O E2E
  (`smoke-routes.spec.ts` → "landing não rola") mede
  `scrollHeight - clientHeight <= 4`; ao mexer no layout, revalide por ele.
- Os atalhos são `GuideTile` (`src/modules/ui/GuidePanel.tsx`). O conteúdo de
  cada painel vive em componentes (`LossCalculator`, `VariantSection`,
  `PracinhaDemo`, `PlanCards` + FAQ inline) — não recrie as seções empilhadas.
- O herói carrega o atalho mais visível para a calculadora ("Quanto você está
  perdendo hoje?"). A promessa da landing é **mostrar em número**, não convencer
  com adjetivo: quem quiser vender mais forte, melhore o número do
  `LossCalculator`, não o texto.
- **O fundo aurora é `absolute inset-0 overflow-hidden`** dentro do root
  (`min-h-screen flex-col`). Um `overflow-hidden` no root corta conteúdo em
  viewport baixa; os blobs com `-left/-right` negativos precisam do clip para
  não criar scroll horizontal. Mantenha esse par.



