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
  return data as Restaurant;
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
