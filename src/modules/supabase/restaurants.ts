import { supabase } from "./client";
import { getCurrentUser } from "./auth";
import type { Restaurant } from "@/lib/types";

/**
 * Resolve a slug to a restaurant
 */
export async function getRestaurantBySlug(
  slug: string,
): Promise<Restaurant | null> {
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
export async function getRestaurantsByOwner(
  ownerId: string,
): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching restaurants:", error);
    return [];
  }
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
async function seedDefaultMenu(restaurantId: string): Promise<void> {
  // Idempotente: já possui categorias → não duplica
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .limit(1);
  if (existing && existing.length > 0) return;

  const catData = [
    { name: "Lanches", sort_order: 0, items: [
      { name: "X-Burger", description: "Pão, hambúrguer, queijo, alface e tomate", price: 18.9 },
      { name: "X-Bacon", description: "Pão, hambúrguer, queijo, bacon crocante", price: 21.9 },
      { name: "X-Tudo", description: "Hambúrguer duplo, queijo, bacon, ovo, presunto", price: 28.9 },
      { name: "Frango Grelhado", description: "Peito de frango grelhado com salada", price: 22.9 },
      { name: "Hot Dog Especial", description: "Salsicha, purê, milho, batata palha", price: 16.9 },
    ] },
    { name: "Bebidas", sort_order: 1, items: [
      { name: "Coca-Cola Lata", description: "350ml gelada", price: 5.9 },
      { name: "Guaraná Lata", description: "350ml gelada", price:  5.9 },
      { name: "Água Mineral", description: "500ml sem gás", price:  3.9 },
      { name: "Suco Natural", description: "Laranja ou limão 400ml", price: 7.9 },
      { name: "Cerveja Lata", description: "Brahma ou Skol 350ml", price:  7.9 },
    ] },
    { name: "Combos", sort_order: 2, items: [
      { name: "Combo Burger + Refri", description: "X-Burger + Coca-Cola Lata por apenas", price:  22.9 },
      { name: "Combo Família", description: "2 X-Tudo + 2 Refris + Batata", price:  69.9 },
      { name: "Combo Fome Zero", description: "X-Bacon + Batata + Refri", price:  32.9 },
    ] },
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
      | "slug"
    >
  >,
): Promise<boolean> {
  const { error } = await supabase
    .from("restaurants")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error updating restaurant:", error);
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
export async function generateUniqueSlug(
  name: string,
  excludeId?: string,
): Promise<string> {
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
    let query = supabase
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .limit(1);

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
