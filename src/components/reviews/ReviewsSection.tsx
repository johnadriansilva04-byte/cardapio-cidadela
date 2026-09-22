import { useState } from "react";
import { MessageSquarePlus, Star } from "lucide-react";
import { ExpandableSection } from "@/modules/ui/ExpandableSection";
import { useRestaurantReviews } from "@/modules/reviews/useRestaurantReviews";
import { ReviewList } from "./ReviewList";
import { ReviewSubmitForm } from "./ReviewSubmitForm";
import { ReviewSkeleton } from "@/components/ui/skeleton";

export interface ReviewsSectionProps {
  restaurantId: string;
  accent?: string;
  /** Nome do cliente que está avaliando (já mascarado na exibição). */
  customerName?: string;
  orderId?: string | null;
}

/**
 * Seção completa de avaliações para o cardápio público: resumo, lista e
 * formulário. Some sozinha quando a migração de avaliações ainda não rodou.
 */
export function ReviewsSection({
  restaurantId,
  accent = "#06b6d4",
  customerName,
  orderId,
}: ReviewsSectionProps) {
  const { reviews, summary, loading, unavailable, submit } = useRestaurantReviews(restaurantId);
  const [formOpen, setFormOpen] = useState(false);

  if (unavailable) return null;

  return (
    <ExpandableSection
      icon={<Star className="size-5" />}
      tone="amber"
      title="Avaliações"
      summary={
        summary.count > 0
          ? `${summary.average.toFixed(1)} de 5 · ${summary.count} avaliaç${summary.count === 1 ? "ão" : "ões"}`
          : "Seja o primeiro a avaliar"
      }
      defaultOpen={summary.count > 0}
    >
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <ReviewSkeleton />
            <ReviewSkeleton />
          </div>
        ) : (
          <ReviewList reviews={reviews} accent={accent} />
        )}

        {customerName && !formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-white/25 hover:text-white"
          >
            <MessageSquarePlus className="size-3.5" aria-hidden="true" />
            Avaliar este restaurante
          </button>
        )}

        {customerName && formOpen && (
          <ReviewSubmitForm
            onSubmit={(input) => submit({ ...input, customerName, orderId })}
            onSuccess={() => setFormOpen(false)}
            accent={accent}
            customerName={customerName}
          />
        )}
      </div>
    </ExpandableSection>
  );
}
