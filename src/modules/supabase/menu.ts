import { supabase } from "./client";
import type { Category, Product, ProductAddon, RestaurantAddon } from "@/lib/types";

/**
 * Get all categories for a restaurant with their products
 */
export async function getMenuWithProducts(
  restaurantId: string,
): Promise<{ categories: Category[]; products: Product[] }> {
  const [catResult, prodResult] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order", { ascending: true }),
  ]);

  return {
    categories: (catResult.data ?? []) as Category[],
    products: (prodResult.data ?? []) as Product[],
  };
}

/**
 * Get categories for a restaurant
 */
export async function getCategories(restaurantId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
  return (data ?? []) as Category[];
}

/**
 * Create a category
 */
export async function createCategory(
  restaurantId: string,
  name: string,
): Promise<Category | null> {
  // Get max sort_order
  const { data: existing } = await supabase
    .from("categories")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("categories")
    .insert({
      restaurant_id: restaurantId,
      name,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating category:", error);
    return null;
  }
  return data as Category;
}

/**
 * Update a category
 */
export async function updateCategory(
  id: string,
  name: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("categories")
    .update({ name })
    .eq("id", id);

  if (error) {
    console.error("Error updating category:", error);
    return false;
  }
  return true;
}

/**
 * Delete a category (and its products via cascade)
 */
export async function deleteCategory(id: string): Promise<boolean> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    console.error("Error deleting category:", error);
    return false;
  }
  return true;
}

/**
 * Move all products from one category to another
 */
export async function moveProductsToCategory(
  fromCategoryId: string,
  toCategoryId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("products")
    .update({ category_id: toCategoryId })
    .eq("category_id", fromCategoryId);

  if (error) {
    console.error("Error moving products:", error);
    return false;
  }
  return true;
}

/**
 * Update sort_order for categories in batch
 */
export async function reorderCategories(
  ids: string[],
): Promise<boolean> {
  const updates = ids.map((id, index) =>
    supabase
      .from("categories")
      .update({ sort_order: index })
      .eq("id", id),
  );

  const results = await Promise.all(updates);
  const hasError = results.some((r) => r.error);
  if (hasError) {
    console.error("Error reordering categories");
    return false;
  }
  return true;
}

/**
 * Update sort_order for products in batch
 */
export async function reorderProducts(
  ids: string[],
): Promise<boolean> {
  const updates = ids.map((id, index) =>
    supabase
      .from("products")
      .update({ sort_order: index })
      .eq("id", id),
  );

  const results = await Promise.all(updates);
  const hasError = results.some((r) => r.error);
  if (hasError) {
    console.error("Error reordering products");
    return false;
  }
  return true;
}

/**
 * Get products for a category
 */
export async function getProducts(
  restaurantId: string,
  categoryId?: string,
): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching products:", error);
    return [];
  }
  return (data ?? []) as Product[];
}

/**
 * Create a product
 */
export async function createProduct(
  product: Omit<Product, "id" | "created_at">,
): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .insert(product)
    .select()
    .single();

  if (error) {
    console.error("Error creating product:", error);
    return null;
  }
  return data as Product;
}

/**
 * Update a product
 */
export async function updateProduct(
  id: string,
  updates: Partial<Omit<Product, "id" | "created_at" | "restaurant_id">>,
): Promise<boolean> {
  const { error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Error updating product:", error);
    return false;
  }
  return true;
}

/**
 * Delete a product
 */
export async function deleteProduct(id: string): Promise<boolean> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    console.error("Error deleting product:", error);
    return false;
  }
  return true;
}

// ============================================================
// PRODUCT ADDONS
// ============================================================

export async function getProductAddons(productId: string): Promise<ProductAddon[]> {
  const { data, error } = await supabase
    .from("product_addons")
    .select("*")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  if (error) {
    // tabela ainda não existe (migration não rodada) — não quebra
    if (String(error.message).toLowerCase().includes("product_addons")) return [];
    console.error("getProductAddons", error);
    return [];
  }
  return (data ?? []) as ProductAddon[];
}

export async function getAddonsByRestaurant(restaurantId: string): Promise<ProductAddon[]> {
  const { data, error } = await supabase
    .from("product_addons")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });
  if (error) {
    if (String(error.message).toLowerCase().includes("product_addons")) return [];
    console.error("getAddonsByRestaurant", error);
    return [];
  }
  return (data ?? []) as ProductAddon[];
}

/**
 * Get global restaurant addons (aplicáveis a qualquer produto)
 * Busca adicionais com product_id null ou vazio, indicando que são globais
 */
export async function getRestaurantAddons(restaurantId: string): Promise<ProductAddon[]> {
  const { data, error } = await supabase
    .from("product_addons")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .is("product_id", null)
    .order("sort_order", { ascending: true });
  if (error) {
    if (String(error.message).toLowerCase().includes("product_addons")) return [];
    console.error("getRestaurantAddons", error);
    return [];
  }
  return (data ?? []) as ProductAddon[];
}

export async function createProductAddon(input: {
  restaurant_id: string;
  product_id: string;
  name: string;
  price: number;
}): Promise<ProductAddon | null> {
  const { data: existing } = await supabase
    .from("product_addons")
    .select("sort_order")
    .eq("product_id", input.product_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;
  const { data, error } = await supabase
    .from("product_addons")
    .insert({ ...input, sort_order: nextOrder, available: true })
    .select()
    .single();
  if (error) {
    console.error("createProductAddon", error);
    return null;
  }
  return data as ProductAddon;
}

export async function updateProductAddon(
  id: string,
  updates: Partial<Pick<ProductAddon, "name" | "price" | "available">>,
): Promise<boolean> {
  const { error } = await supabase.from("product_addons").update(updates).eq("id", id);
  if (error) {
    console.error("updateProductAddon", error);
    return false;
  }
  return true;
}

export async function deleteProductAddon(id: string): Promise<boolean> {
  const { error } = await supabase.from("product_addons").delete().eq("id", id);
  if (error) {
    console.error("deleteProductAddon", error);
    return false;
  }
  return true;
}

export async function reorderProductAddons(ids: string[]): Promise<boolean> {
  const results = await Promise.all(ids.map((id, idx) => supabase.from("product_addons").update({ sort_order: idx }).eq("id", id)));
  return !results.some((r) => r.error);
}

/**
 * Toggle product availability
 */
export async function toggleProductAvailability(
  id: string,
  available: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from("products")
    .update({ available })
    .eq("id", id);

  if (error) {
    console.error("Error toggling product:", error);
    return false;
  }
  return true;
}
