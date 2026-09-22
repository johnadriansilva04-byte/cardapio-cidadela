import { supabase } from "./client";
import type { Promotion } from "@/lib/loyalty";

/** Lista as promoções de um restaurante (todas, ativas ou não) para o admin. */
export async function getPromotions(restaurantId: string): Promise<Promotion[]> {
  try {
    const { data, error } = await supabase
      .from("promotions")
      .select("id, title, description, kind, value, active, sort_order, starts_at, ends_at")
      .eq("restaurant_id", restaurantId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error || !Array.isArray(data)) return [];
    return data.map((row) => {
      const r = row as unknown as Promotion & { active: boolean; sort_order: number };
      return { ...r, value: Number(r.value ?? 0) };
    });
  } catch {
    // Migração ainda não aplicada: a tela fica vazia em vez de quebrar.
    return [];
  }
}

/** Cria ou atualiza uma promoção. */
export async function savePromotion(
  restaurantId: string,
  input: {
    id?: string;
    title: string;
    description?: string;
    kind: Promotion["kind"];
    value: number;
    active?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
  },
): Promise<Promotion | null> {
  const payload = {
    restaurant_id: restaurantId,
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    kind: input.kind,
    value: input.value,
    active: input.active ?? true,
    starts_at: input.starts_at ?? null,
    ends_at: input.ends_at ?? null,
  };

  const query = input.id
    ? supabase.from("promotions").update(payload).eq("id", input.id)
    : supabase.from("promotions").insert(payload);

  const { data, error } = await query.select().single();
  if (error) {
    console.error("[promotions] save error:", error.message);
    return null;
  }
  return data as Promotion;
}

/** Remove uma promoção. Resgates já feitos permanecem no histórico do cliente. */
export async function deletePromotion(id: string): Promise<boolean> {
  const { error } = await supabase.from("promotions").delete().eq("id", id);
  if (error) {
    console.error("[promotions] delete error:", error.message);
    return false;
  }
  return true;
}
