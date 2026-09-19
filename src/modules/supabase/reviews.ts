import { supabase } from "./client";
import type { Review } from "@/lib/reviews";
import { validateReviewInput } from "@/lib/reviews";

const TABLE = "reviews";

/** PostgREST devolve 42P01 quando a tabela ainda não foi criada no banco. */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || /relation .* does not exist/i.test(error.message ?? "");
}

export interface ReviewsResult {
  reviews: Review[];
  /** `true` quando a migração de avaliações ainda não foi aplicada. */
  unavailable: boolean;
}

/**
 * Avaliações públicas de um restaurante. Sem a migração aplicada devolve lista
 * vazia e sinaliza `unavailable` — a UI esconde a seção em vez de quebrar.
 */
export async function getReviews(restaurantId: string, limit = 50): Promise<ReviewsResult> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (!isMissingTable(error)) console.error("Error fetching reviews:", error);
    return { reviews: [], unavailable: isMissingTable(error) };
  }
  return { reviews: (data ?? []) as Review[], unavailable: false };
}

export interface SubmitReviewParams {
  restaurantId: string;
  rating: number;
  comment?: string;
  customerName: string;
  orderId?: string | null;
}

/**
 * Registra uma avaliação do cliente. A validação roda aqui também porque o
 * cliente pode chamar isso fora do formulário (ex.: link de acompanhamento).
 */
export async function submitReview(
  params: SubmitReviewParams,
): Promise<{ review: Review | null; error?: string }> {
  const message = validateReviewInput({ rating: params.rating, comment: params.comment });
  if (message) return { review: null, error: message };

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      restaurant_id: params.restaurantId,
      order_id: params.orderId ?? null,
      rating: params.rating,
      comment: (params.comment ?? "").trim(),
      customer_name: params.customerName,
    })
    .select()
    .single();

  if (error) {
    if (isMissingTable(error)) {
      return { review: null, error: "Avaliações ainda não estão disponíveis neste restaurante." };
    }
    console.error("Error submitting review:", error);
    return { review: null, error: "Não foi possível enviar sua avaliação. Tente novamente." };
  }
  return { review: data as Review };
}

/** Aplica o resumo público de notas em lote (usado em listagens). */
export async function getReviewsByRestaurants(
  restaurantIds: string[],
): Promise<Map<string, Review[]>> {
  const map = new Map<string, Review[]>();
  if (restaurantIds.length === 0) return map;

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .in("restaurant_id", restaurantIds)
    .order("created_at", { ascending: false });

  if (error) {
    if (!isMissingTable(error)) console.error("Error fetching reviews:", error);
    return map;
  }
  for (const row of (data ?? []) as Review[]) {
    const list = map.get(row.restaurant_id) ?? [];
    list.push(row);
    map.set(row.restaurant_id, list);
  }
  return map;
}