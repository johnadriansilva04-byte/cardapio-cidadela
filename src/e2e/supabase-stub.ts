/**
 * Stub de `@supabase/supabase-js` para testes E2E (apenas quando E2E=1).
 *
 * Não é um mock de teste unitário: é um backend em memória que implementa a
 * mesma superfície encadeável do client real (`from().select().eq().maybeSingle()`,
 * `rpc`, `channel`, `functions.invoke`, `auth`). Os testes E2E dirigem a UI de
 * verdade; as consultas caem aqui. Assim dá para exercitar os fluxos públicos
 * sem um projeto Supabase real.
 *
 * O dataset pode ser sobrescrito pelo teste via `window.__E2E_DB__` (injetado
 * com `page.addInitScript`), permitindo cenários de erro (loja fechada, RPC
 * indisponível etc.).
 */

type Row = Record<string, unknown>;

interface E2EDb {
  restaurants: Row[];
  categories: Row[];
  products: Row[];
  product_addons: Row[];
  delivery_neighborhoods: Row[];
  orders: Row[];
  order_items: Row[];
  order_status_history: Row[];
  reviews: Row[];
  order_tracking: Row[];
  profiles: Row[];
  admin_trials: Row[];
  cidadela_unlocks: Row[];
  push_subscriptions: Row[];
  /** RPCs/consultas que devem falhar (ex.: ["get_order_tracking"]). */
  failRpc?: string[];
  /** Força o preço/indisponibilidade no servidor sem alterar a lista da tela. */
  serverAvailability?: Record<string, boolean>;
}

declare global {
  var __E2E_DB__: E2EDb | undefined;
  var __E2E_SEED__: Partial<E2EDb> | undefined;
  /** Sessão logada para exercitar telas autenticadas no E2E. */
  var __E2E_SESSION__: E2ESession | undefined;
}

export interface E2ESession {
  user: {
    id: string;
    email?: string;
    phone?: string;
    user_metadata?: Record<string, unknown>;
  };
}

const RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";

function defaultDb(): E2EDb {
  return {
    restaurants: [
      {
        id: RESTAURANT_ID,
        owner_id: "owner-1",
        slug: "cidadela-teste",
        name: "Cidadela Teste",
        description: "Comida de verdade",
        slogan: "O melhor da cidade",
        logo_url: null,
        banner_url: null,
        status: "published",
        primary_color: "#06b6d4",
        secondary_color: "#8b5cf6",
        delivery_fee: 5,
        whatsapp: "5511999999999",
        address: "Rua Teste, 1",
        pix_key: "pix@teste.com",
        operating_hours: null,
        created_at: new Date().toISOString(),
      },
    ],
    categories: [
      { id: "cat-1", restaurant_id: RESTAURANT_ID, name: "Lanches", sort_order: 0 },
      { id: "cat-2", restaurant_id: RESTAURANT_ID, name: "Bebidas", sort_order: 1 },
    ],
    products: [
      {
        id: "prod-1",
        restaurant_id: RESTAURANT_ID,
        category_id: "cat-1",
        name: "X-Burger",
        description: "Pão, carne e queijo",
        price: 18.5,
        image_url: null,
        available: true,
        sort_order: 0,
      },
      {
        id: "prod-2",
        restaurant_id: RESTAURANT_ID,
        category_id: "cat-2",
        name: "Refrigerante",
        description: "Lata 350ml",
        price: 6,
        image_url: null,
        available: true,
        sort_order: 0,
      },
      {
        id: "prod-3",
        restaurant_id: RESTAURANT_ID,
        category_id: "cat-1",
        name: "Esgotado",
        description: "Indisponível",
        price: 10,
        image_url: null,
        available: false,
        sort_order: 1,
      },
    ],
    product_addons: [
      {
        id: "addon-1",
        restaurant_id: RESTAURANT_ID,
        product_id: "prod-1",
        name: "Bacon extra",
        price: 4,
        available: true,
      },
    ],
    delivery_neighborhoods: [{ id: "nb-1", restaurant_id: RESTAURANT_ID, name: "Centro", fee: 5 }],
    orders: [],
    order_items: [],
    order_status_history: [],
    reviews: [],
    order_tracking: [],
    profiles: [],
    admin_trials: [],
    cidadela_unlocks: [],
    push_subscriptions: [],
    failRpc: [],
  };
}

function getDb(): E2EDb {
  if (typeof globalThis !== "undefined" && globalThis.__E2E_DB__) {
    return globalThis.__E2E_DB__;
  }
  const fresh = defaultDb();
  // O teste injeta um dataset parcial via `__E2E_SEED__` (addInitScript roda
  // antes do stub existir, então não dá para sobrescrever o banco direto).
  if (typeof globalThis !== "undefined" && globalThis.__E2E_SEED__) {
    Object.assign(fresh, globalThis.__E2E_SEED__);
  }
  if (typeof globalThis !== "undefined") globalThis.__E2E_DB__ = fresh;
  return fresh;
}

function matches(row: Row, filters: [string, unknown][]): boolean {
  return filters.every(([col, val]) => {
    if (Array.isArray(val)) return val.includes(row[col]);
    return row[col] === val;
  });
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

/** Hash estável (FNV-ish) para a chave de idempotência do stub. */
function stubHash(raw: string): string {
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h) ^ raw.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Espelha a RPC `create_order_atomic` do banco: recalcula os preços a partir
 * dos produtos/adicionais/bairros e grava pedido + itens + histórico numa
 * "transação" (só muta os arrays no fim, depois de validar tudo). Serve para o
 * E2E provar que o total não vem do cliente e que um pedido nunca fica sem
 * itens.
 */
function createOrderAtomic(
  db: E2EDb,
  args?: Record<string, unknown>,
): Promise<{ data: unknown; error: unknown }> {
  const restaurantId = args?.p_restaurant_id as string;
  const order = (args?.p_order ?? {}) as Record<string, unknown>;
  const items = (args?.p_items ?? []) as Record<string, unknown>[];

  const restaurant = db.restaurants.find((r) => r.id === restaurantId);
  if (!restaurant) {
    return Promise.resolve({ data: null, error: { message: "Restaurante não encontrado." } });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return Promise.resolve({ data: null, error: { message: "Carrinho vazio." } });
  }

  const override = db.serverAvailability ?? {};
  const pricedItems: Row[] = [];
  let subtotal = 0;
  for (const it of items) {
    const product = db.products.find(
      (p) => p.id === it.product_id && p.restaurant_id === restaurantId,
    );
    if (!product) {
      return Promise.resolve({
        data: null,
        error: { message: "Um item do seu carrinho não está mais disponível." },
      });
    }
    const available =
      String(product.id) in override ? override[String(product.id)] : product.available;
    if (available === false) {
      return Promise.resolve({
        data: null,
        error: { message: `"${product.name}" está indisponível no momento.` },
      });
    }
    const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
    const addonIds = (it.addon_ids as string[]) ?? [];
    let addonSum = 0;
    const addonNames: string[] = [];
    for (const id of addonIds) {
      const addon = db.product_addons.find(
        (a) => a.id === id && (!a.restaurant_id || a.restaurant_id === restaurantId),
      );
      if (!addon) continue;
      addonSum += Number(addon.price) || 0;
      addonNames.push(String(addon.name));
    }
    const unit = Math.round(((Number(product.price) || 0) + addonSum) * 100) / 100;
    const lineTotal = Math.round(unit * qty * 100) / 100;
    subtotal += lineTotal;
    const name = addonNames.length
      ? `${product.name} (+ ${addonNames.join(", ")})`
      : String(product.name);
    pricedItems.push({
      id: uuid(),
      product_id: product.id,
      product_name: name,
      quantity: qty,
      unit_price: unit,
      total: lineTotal,
      notes: (it.notes as string) ?? "",
    });
  }
  subtotal = Math.round(subtotal * 100) / 100;
  let deliveryFee = 0;
  if (order.delivery_type === "entrega") {
    const wanted = String(order.customer_neighborhood ?? "")
      .trim()
      .toLowerCase();
    const nb = wanted
      ? db.delivery_neighborhoods.find(
          (n) => n.restaurant_id === restaurantId && String(n.name).trim().toLowerCase() === wanted,
        )
      : undefined;
    deliveryFee = Math.round(Number(nb?.fee ?? restaurant.delivery_fee ?? 0) * 100) / 100;
  }
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;

  const sig = pricedItems
    .map((p) => `${p.product_id}:${p.quantity}:${p.unit_price}:${p.notes ?? ""}`)
    .join("|");
  const key =
    "idem-" +
    stubHash(`${restaurantId}|${order.customer_phone ?? ""}|${order.comanda ?? ""}|${sig}`);
  const existing = db.orders.find((o) => o.idempotency_key === key);
  if (existing && existing.status !== "cancelled") {
    return Promise.resolve({ data: { order: existing, items: pricedItems }, error: null });
  }

  const id = uuid();
  const now = new Date().toISOString();
  const row: Row = {
    id,
    restaurant_id: restaurantId,
    idempotency_key: key,
    comanda: order.comanda ?? "",
    customer_id: order.customer_id ?? null,
    guest_id: order.guest_id ?? null,
    customer_name: order.customer_name ?? "",
    customer_phone: order.customer_phone ?? "",
    customer_email: order.customer_email ?? "",
    delivery_address: order.delivery_address ?? "",
    customer_complement: order.customer_complement ?? "",
    customer_neighborhood: order.customer_neighborhood ?? "",
    customer_city: order.customer_city ?? "",
    delivery_type: order.delivery_type ?? "retirada",
    observations: order.observations ?? "",
    subtotal,
    delivery_fee: deliveryFee,
    total,
    payment_method: order.payment_method ?? "pix",
    payment_status: order.payment_method === "pix" ? "awaiting_confirmation" : "pending",
    status: "received",
    cidadela_unlocked: false,
    created_at: now,
    updated_at: now,
  };

  // "Transação": só grava depois de todas as validações passarem.
  db.orders.push(row);
  for (const p of pricedItems) {
    db.order_items.push({ ...p, order_id: id, created_at: now });
  }
  db.order_status_history.push({
    id: uuid(),
    order_id: id,
    status: "received",
    note: "Pedido criado",
    created_at: now,
  });

  return Promise.resolve({ data: { order: row, items: pricedItems }, error: null });
}

class QueryBuilder implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: [string, unknown][] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private onConflict = "id";

  constructor(private table: string) {}

  select(): this {
    if (this.mode !== "insert" && this.mode !== "update" && this.mode !== "upsert") {
      this.mode = "select";
    }
    return this;
  }
  insert(payload: Row | Row[]): this {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row): this {
    this.mode = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: Row | Row[], opts?: { onConflict?: string }): this {
    this.mode = "upsert";
    this.payload = payload;
    this.onConflict = opts?.onConflict ?? "id";
    return this;
  }
  delete(): this {
    this.mode = "delete";
    return this;
  }
  eq(col: string, val: unknown): this {
    this.filters.push([col, val]);
    return this;
  }
  in(col: string, val: unknown[]): this {
    this.filters.push([col, val]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  private run(): { data: unknown; error: unknown } {
    const db = getDb();
    const rows = (db as unknown as Record<string, Row[]>)[this.table] ?? [];
    if (this.mode === "insert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
      for (const r of list) {
        const row = { id: r.id ?? `e2e-${Math.random().toString(36).slice(2)}`, ...r };
        rows.push(row);
      }
      return { data: list.map((r) => r as Row), error: null };
    }
    if (this.mode === "upsert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
      for (const r of list) {
        const existing = rows.find((x) => x[this.onConflict] === r[this.onConflict]);
        if (existing) Object.assign(existing, r);
        else rows.push({ id: `e2e-${Math.random().toString(36).slice(2)}`, ...r });
      }
      return { data: list, error: null };
    }
    if (this.mode === "update") {
      const hit = rows.filter((r) => matches(r, this.filters));
      for (const r of hit) Object.assign(r, this.payload);
      return { data: hit, error: null };
    }
    if (this.mode === "delete") {
      const hit = rows.filter((r) => matches(r, this.filters));
      for (const r of hit) rows.splice(rows.indexOf(r), 1);
      return { data: hit, error: null };
    }
    let result = rows.filter((r) => matches(r, this.filters));
    // Sobrescreve a disponibilidade só para o que o servidor "vê" — a UI já
    // carregada mantém a lista original. Permite testar a corrida entre a tela
    // e o momento do pedido sem tocar no array que o React renderiza.
    if (this.table === "products" && getDb().serverAvailability) {
      const override = getDb().serverAvailability!;
      result = result.map((r) =>
        String(r.id) in override ? { ...r, available: override[String(r.id)] } : r,
      );
    }
    if (this.orderCol) {
      const col = this.orderCol;
      result = [...result].sort((a, b) =>
        this.orderAsc ? compare(a[col], b[col]) : compare(b[col], a[col]),
      );
    }
    if (this.limitN != null) result = result.slice(0, this.limitN);
    return { data: result, error: null };
  }

  private withRelations(rows: Row[]): Row[] {
    if (this.table === "orders") {
      const db = getDb();
      return rows.map((o) => ({
        ...o,
        order_items: db.order_items.filter((i) => i.order_id === o.id),
      }));
    }
    return rows;
  }

  maybeSingle(): Promise<{ data: Row | null; error: unknown }> {
    const { data, error } = this.run();
    const arr = (data as Row[]) ?? [];
    return Promise.resolve({ data: this.withRelations(arr)[0] ?? null, error });
  }
  single(): Promise<{ data: Row | null; error: unknown }> {
    const { data, error } = this.run();
    const arr = (data as Row[]) ?? [];
    return Promise.resolve({
      data: this.withRelations(arr)[0] ?? null,
      error: error ?? (arr.length ? null : { message: "no rows" }),
    });
  }
  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const { data, error } = this.run();
    const value = { data: this.withRelations((data as Row[]) ?? []), error };
    return Promise.resolve(value).then(onfulfilled, onrejected);
  }
}

class Channel {
  on(): this {
    return this;
  }
  subscribe(): this {
    return this;
  }
}

/** Usuário logado no E2E, quando o teste injeta `__E2E_SESSION__`. */
function getE2ESessionUser(): E2ESession["user"] | null {
  if (typeof globalThis !== "undefined" && globalThis.__E2E_SESSION__) {
    return globalThis.__E2E_SESSION__.user;
  }
  return null;
}

class StubClient {
  from(table: string): QueryBuilder {
    return new QueryBuilder(table);
  }

  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> {
    const db = getDb();
    if (db.failRpc?.includes(name)) {
      return Promise.resolve({ data: null, error: { message: `${name} indisponível (E2E)` } });
    }
    if (name === "get_order_tracking") {
      const row = db.order_tracking.find((o) => o.id === args?.p_oid);
      return Promise.resolve({ data: row ? [row] : [], error: null });
    }
    if (name === "get_my_orders") return Promise.resolve({ data: [], error: null });
    if (name === "owner_monthly_order_count") return Promise.resolve({ data: 0, error: null });
    if (name === "owner_locked_stores") return Promise.resolve({ data: [], error: null });
    if (name === "create_order_atomic") return createOrderAtomic(db, args);
    return Promise.resolve({ data: null, error: null });
  }
  channel(): Channel {
    return new Channel();
  }
  removeChannel(): void {
    /* no-op */
  }
  functions = {
    invoke: () => Promise.resolve({ data: null, error: null }),
  };
  auth = {
    getSession: () => {
      const user = getE2ESessionUser();
      return Promise.resolve({
        data: { session: user ? { user, access_token: "e2e-token" } : null },
        error: null,
      });
    },
    getUser: () => Promise.resolve({ data: { user: getE2ESessionUser() }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => undefined } },
    }),
    signInWithPassword: () => Promise.resolve({ data: {}, error: { message: "E2E" } }),
    signOut: () => Promise.resolve({ error: null }),
    updateUser: () => Promise.resolve({ data: {}, error: null }),
    resetPasswordForEmail: () => Promise.resolve({ data: {}, error: null }),
  };
}

export function createClient(): StubClient {
  const client = new StubClient();
  // Exposto só em E2E: permite ao teste chamar a RPC como um anon malicioso e
  // provar que o preço é recalculado no "servidor", não no navegador.
  if (typeof window !== "undefined") {
    (window as unknown as { __E2E_CLIENT__?: StubClient }).__E2E_CLIENT__ = client;
  }
  return client;
}

export type SupabaseClient = StubClient;

export default { createClient };
