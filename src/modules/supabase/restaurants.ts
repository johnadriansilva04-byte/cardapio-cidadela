import { supabase } from "./client";
import { getCurrentUser } from "./auth";
import type { Restaurant, DeliveryNeighborhood } from "@/lib/types";

// Cache admin_trials availability per session to avoid repeated 400 errors
let _adminTrialsAvailable: boolean | null = null;

/**
 * Resolve a slug to a restaurant
 */
export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as Restaurant;
}

/**
 * Get all restaurants for an owner
 */
export async function getRestaurantsByOwner(ownerId: string): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching restaurants:", error);
    return [];
  }

  // Sem auto-publish aqui: mudar `status` ao ler transformava "Pausado" em
  // "Publicado" a cada abertura do painel, como efeito colateral de um fetch.
  return (data ?? []) as Restaurant[];
}

/**
 * Create a new restaurant
 */
export async function createRestaurant(
  ownerId: string,
  name: string,
  slug: string,
  description?: string,
): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from("restaurants")
    .insert({
      owner_id: ownerId,
      name,
      slug,
      description: description ?? "",
      // Nasce publicado para que o link público funcione imediatamente.

      status: "published",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating restaurant:", error);
    return null;
  }

  // Seed default categories for the new restaurant
  if (data) {
    await seedDefaultMenu(data.id);
  }

  return data as Restaurant;
}

/**
 * Seed default categories for a new restaurant
 */
export async function seedDefaultMenu(restaurantId: string): Promise<void> {
  // Idempotente: já possui categorias → não duplica
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .limit(1);
  if (existing && existing.length > 0) return;

  const catData = [
    {
      name: "Lanches",
      sort_order: 0,
      items: [
        { name: "X-Burger", description: "Pão, hambúrguer, queijo, alface e tomate", price: 18.9 },
        { name: "X-Bacon", description: "Pão, hambúrguer, queijo, bacon crocante", price: 21.9 },
        {
          name: "X-Tudo",
          description: "Hambúrguer duplo, queijo, bacon, ovo, presunto",
          price: 28.9,
        },
        {
          name: "Frango Grelhado",
          description: "Peito de frango grelhado com salada",
          price: 22.9,
        },
        {
          name: "Hot Dog Especial",
          description: "Salsicha, purê, milho, batata palha",
          price: 16.9,
        },
      ],
    },
    {
      name: "Bebidas",
      sort_order: 1,
      items: [
        { name: "Coca-Cola Lata", description: "350ml gelada", price: 5.9 },
        { name: "Guaraná Lata", description: "350ml gelada", price: 5.9 },
        { name: "Água Mineral", description: "500ml sem gás", price: 3.9 },
        { name: "Suco Natural", description: "Laranja ou limão 400ml", price: 7.9 },
        { name: "Cerveja Lata", description: "Brahma ou Skol 350ml", price: 7.9 },
      ],
    },
    {
      name: "Combos",
      sort_order: 2,
      items: [
        {
          name: "Combo Burger + Refri",
          description: "X-Burger + Coca-Cola Lata por apenas",
          price: 22.9,
        },
        { name: "Combo Família", description: "2 X-Tudo + 2 Refris + Batata", price: 69.9 },
        { name: "Combo Fome Zero", description: "X-Bacon + Batata + Refri", price: 32.9 },
      ],
    },
  ];

  for (const cat of catData) {
    const { data: catRow, error: catError } = await supabase
      .from("categories")
      .insert({ restaurant_id: restaurantId, name: cat.name, sort_order: cat.sort_order })
      .select("id")
      .single();
    if (catError || !catRow) {
      console.error("Error seeding category:", cat.name, catError);
      continue;
    }
    const productRows = cat.items.map((item, i) => ({
      restaurant_id: restaurantId,
      category_id: catRow.id,
      name: item.name,
      description: item.description,
      price: item.price,
      sort_order: i,
    }));
    const { error: prodError } = await supabase.from("products").insert(productRows);
    if (prodError) {
      console.error("Error seeding products:", cat.name, prodError);
    }
  }
}

/**
 * Update restaurant settings
 */
export async function updateRestaurant(
  id: string,
  updates: Partial<
    Pick<
      Restaurant,
      | "name"
      | "description"
      | "phone"
      | "whatsapp"
      | "address"
      | "logo_url"
      | "banner_url"
      | "primary_color"
      | "secondary_color"
      | "status"
      | "pix_key"
      | "operating_hours"
      | "slug"
      | "delivery_fee"
    >
  >,
): Promise<boolean> {
  const payload = { ...updates, updated_at: new Date().toISOString() } as Record<string, unknown>;
  const { error } = await supabase.from("restaurants").update(payload).eq("id", id);

  if (error) {
    // Graceful fallback: se a migration de operating_hours ainda não foi rodada,
    // o campo ainda não existe no DB e o update falha. Tenta sem ele.
    // Só vale quando operating_hours está de fato no payload — um erro de outra
    // coluna antes abortava o update inteiro e ainda perdia este campo.
    const msg = String(error.message ?? "").toLowerCase();
    const code = String((error as unknown as { code?: string }).code ?? "");
    const missingColumn = /could not find the '([^']+)' column/i.exec(msg)?.[1];
    const isMissingOperatingHours =
      "operating_hours" in payload &&
      (missingColumn === "operating_hours" ||
        ((code === "PGRST204" || code === "42703") && msg.includes("operating_hours")));
    if (isMissingOperatingHours) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { operating_hours: _omit, ...rest } = payload;
      console.warn("[restaurants] operating_hours column missing — retrying without it. Rode supabase/schema.sql", error);
      const { error: retryError } = await supabase.from("restaurants").update(rest).eq("id", id);
      if (retryError) {
        console.error("Error updating restaurant (retry):", retryError);
        return false;
      }
      return true;
    }
    console.error("Error updating restaurant:", error);
    return false;
  }
  return true;
}
/**
 * List delivery neighborhoods (taxa por bairro) for a restaurant
 */
export async function getNeighborhoods(restaurantId: string): Promise<DeliveryNeighborhood[]> {
  const { data, error } = await supabase
    .from("delivery_neighborhoods")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("name");
  if (error) {
    console.error("Error fetching neighborhoods:", error);
    return [];
  }
  return (data ?? []) as DeliveryNeighborhood[];
}

/**
 * Create/update a delivery neighborhood. Returns the row or null on failure.
 */
export async function saveNeighborhood(
  restaurantId: string,
  input: { id?: string; name: string; fee: number },
): Promise<DeliveryNeighborhood | null> {
  const payload = { restaurant_id: restaurantId, name: input.name.trim(), fee: input.fee };
  if (input.id) {
    const { data, error } = await supabase
      .from("delivery_neighborhoods")
      .update(payload)
      .eq("id", input.id)
      .select()
      .single();
    if (error) {
      console.error("Error updating neighborhood:", error);
      return null;
    }
    return data as DeliveryNeighborhood;
  }
  const { data, error } = await supabase
    .from("delivery_neighborhoods")
    .insert(payload)
    .select()
    .single();
  if (error) {
    console.error("Error creating neighborhood:", error);
    return null;
  }
  return data as DeliveryNeighborhood;
}

/**
 * Delete a delivery neighborhood
 */
export async function deleteNeighborhood(id: string): Promise<boolean> {
  const { error } = await supabase.from("delivery_neighborhoods").delete().eq("id", id);
  if (error) {
    console.error("Error deleting neighborhood:", error);
    return false;
  }
  return true;
}

/**
 * Delete a restaurant and all its data
 */
export async function deleteRestaurant(id: string): Promise<boolean> {
  const { error } = await supabase.from("restaurants").delete().eq("id", id);
  if (error) {
    console.error("Error deleting restaurant:", error);
    return false;
  }
  return true;
}

/**
 * Generate a unique slug from a name, checking for conflicts
 */
export async function generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
  const baseSlug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  let slug = baseSlug;
  let counter = 0;

  while (true) {
    let query = supabase.from("restaurants").select("id").eq("slug", slug).limit(1);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data } = await query;
    if (!data || data.length === 0) return slug;

    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}

/**
 * Get the current authenticated user's ID as the owner_id.
 * Falls back to a random ID only during initial render before auth is ready.
 */
export async function getOwnerId(): Promise<string> {
  const user = await getCurrentUser();
  if (user) return user.id;
  // Fallback should never happen in authenticated routes
  return `anonymous_${Date.now()}`;
}

/**
 * Synchronous version — returns the user ID from an active session.
 * Must be called after auth is initialized (e.g. inside a component with useAuth).
 */
export function getOwnerIdSync(userId: string | undefined): string {
  return userId || `anonymous_${Date.now()}`;
}

/**
 * Reconciles legacy trial accounts with real restaurants for the authenticated user.
 * For each active legacy trial whose email/phone matches the user, it creates the
 * restaurant (with owner_id = user.id) or claims an existing one created on-demand
 * by the public fallback (owner_id = trial.store_id).
 *
 * Usa `.in()` em vez de `.or()` — evita 400 por caracteres especiais como `@` no
 * PostgREST (ex: 48999880030@menufacil.local) e é mais robusto para encode.
 */
export async function ensureRestaurantsForUser(user: {
  id: string;
  email?: string | null;
  phone?: string | null;
}): Promise<void> {
  if (!user?.id) return;

  // Skip if admin_trials was already confirmed missing
  if (_adminTrialsAvailable === false) return;

  const raw = [user.email, user.phone].filter((v): v is string => Boolean(v)) as string[];
  const lookups = [...new Set(raw.map((v) => v.trim()).filter(Boolean))];
  if (lookups.length === 0) return;

  // Busca legacy em duas consultas com `.in()` (robusto p/ `@`, `+`, etc.)
  const baseSel = "store_id, store_name, store_slogan, pix_key, whatsapp";
  const [byEmail, byPhone] = await Promise.all([
    supabase.from("admin_trials").select(baseSel).in("admin_email", lookups).eq("is_active", true).limit(10),
    supabase.from("admin_trials").select(baseSel).in("admin_phone", lookups).eq("is_active", true).limit(10),
  ]);

  const error = byEmail.error ?? byPhone.error;
  if (error) {
    const code = String((error as unknown as { code?: string }).code ?? "");
    const msg = String(error.message ?? "").toLowerCase();
    // 42P01 = undefined_table, PGRST116 etc — legacy pode não existir no banco
    if (code === "42P01" || code === "PGRST205" || msg.includes("admin_trials")) {
      _adminTrialsAvailable = false;
    }
    return;
  }

  type LegacyRow = { store_id: string; store_name: string | null; store_slogan: string | null; pix_key: string | null; whatsapp: string | null };
  const emailRows = (byEmail.data ?? []) as LegacyRow[];
  const phoneRows = (byPhone.data ?? []) as LegacyRow[];
  const merged = new Map<string, LegacyRow>();
  for (const t of [...emailRows, ...phoneRows]) {
    const key = String(t.store_id ?? "");
    if (key && !merged.has(key)) merged.set(key, t);
  }
  const trials = [...merged.values()];

  _adminTrialsAvailable = true;
  if (trials.length === 0) return;

  for (const trial of trials) {
    const { data: existing } = await supabase
      .from("restaurants")
      .select("id, owner_id, status")
      .eq("slug", trial.store_id)
      .maybeSingle();

    if (existing) {
      const updates: Record<string, unknown> = {};
      if (existing.owner_id !== user.id) updates.owner_id = user.id;
      if (existing.status === "draft") updates.status = "published";
      if (Object.keys(updates).length > 0) {
        await supabase.from("restaurants").update(updates).eq("id", existing.id);
      }
    } else {
      await supabase.from("restaurants").insert({
        owner_id: user.id,
        name: trial.store_name ?? "Meu Restaurante",
        slug: trial.store_id,
        description: trial.store_slogan ?? "",
        whatsapp: trial.whatsapp ?? "",
        pix_key: trial.pix_key ?? "",
        status: "published",
      });
    }
  }
}
