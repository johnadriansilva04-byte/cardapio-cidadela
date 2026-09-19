import { MessageSquare, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { maskReviewerName, relativeReviewDate, summarizeReviews, type Review } from "@/lib/reviews";
import { EmptyState } from "@/modules/ui/Feedback";

export interface ReviewListProps {
  reviews: Review[];
  accent?: string;
  className?: string;
}

/**
 * Lista as avaliações com um resumo no topo. Quando só há uma nota (nota típica
 * de dono de restaurante pequeno), o resumo ainda ajuda a dar contexto.
 */
export function ReviewList({ reviews, accent = "#06b6d4", className }: ReviewListProps) {
  const summary = summarizeReviews(reviews);

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="Sem avaliações ainda"
        description="As avaliações aparecem aqui depois que os clientes finalizarem pedidos."
        className={cn("border-white/10", className)}
      />
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="text-center">
          <p className="text-2xl font-black text-white">{summary.average.toFixed(1)}</p>
          <p className="text-[10px] text-gray-500">
            {summary.count} avaliaç{summary.count === 1 ? "ão" : "ões"}
          </p>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {summary.distribution.map((entry) => (
            <div key={entry.rating} className="flex items-center gap-2">
              <span className="w-3 text-right text-[10px] font-bold text-gray-500">
                {entry.rating}
              </span>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${entry.percent}%`, backgroundColor: accent }}
                />
              </div>
              <span className="w-6 text-right text-[10px] text-gray-500">{entry.count}</span>
            </div>
          ))}
        </div>
      </div>

      <ul className="space-y-2">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-bold text-gray-200">
                {maskReviewerName(review.customer_name)}
              </span>
              <span className="shrink-0 text-[10px] text-gray-500">
                {relativeReviewDate(review.created_at)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "size-3",
                    i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-700",
                  )}
                  aria-hidden="true"
                />
              ))}
            </div>
            {review.comment && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-400">
                <MessageSquare className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                {review.comment}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
