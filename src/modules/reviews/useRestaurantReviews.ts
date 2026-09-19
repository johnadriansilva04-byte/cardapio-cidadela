import { useCallback, useEffect, useMemo, useState } from "react";
import { getReviews, submitReview } from "@/modules/supabase/reviews";
import { summarizeReviews, type Review, type ReviewSummary } from "@/lib/reviews";
import { analytics } from "@/modules/analytics";

export interface UseRestaurantReviewsResult {
  reviews: Review[];
  summary: ReviewSummary;
  loading: boolean;
  /** `true` quando a migração de avaliações não foi aplicada no banco. */
  unavailable: boolean;
  error: string | null;
  submit: (input: {
    rating: number;
    comment: string;
    customerName: string;
    orderId?: string | null;
  }) => Promise<{ error?: string }>;
  refresh: () => Promise<void>;
}

/**
 * Carrega e envia avaliações de um restaurante.
 *
 * Se a migração ainda não foi aplicada, `unavailable` fica `true` e a UI
 * esconde a seção — nada de erro na cara do cliente.
 */
export function useRestaurantReviews(restaurantId: string | undefined): UseRestaurantReviewsResult {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setReviews([]);
      setLoading(false);
      return;
    }
    setError(null);
    const result = await getReviews(restaurantId);
    setReviews(result.reviews);
    setUnavailable(result.unavailable);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void load().catch(() => {
      if (alive) setError("Não foi possível carregar as avaliações.");
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const submit = useCallback<UseRestaurantReviewsResult["submit"]>(
    async (input) => {
      if (!restaurantId) return { error: "Restaurante inválido." };
      const { review, error: submitError } = await submitReview({
        restaurantId,
        rating: input.rating,
        comment: input.comment,
        customerName: input.customerName,
        orderId: input.orderId,
      });
      if (submitError || !review) return { error: submitError ?? "Falha ao enviar avaliação." };

      setReviews((prev) => [review, ...prev]);
      analytics.track("review_submitted", {
        rating: input.rating,
        hasComment: Boolean(input.comment),
      });
      return {};
    },
    [restaurantId],
  );

  const summary = useMemo(() => summarizeReviews(reviews), [reviews]);

  return { reviews, summary, loading, unavailable, error, submit, refresh: load };
}
