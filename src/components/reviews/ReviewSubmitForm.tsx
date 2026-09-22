import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_COMMENT_LENGTH, validateReviewInput } from "@/lib/reviews";
import { RatingInput } from "./RatingInput";

export interface ReviewSubmitFormProps {
  onSubmit: (input: { rating: number; comment: string }) => Promise<{ error?: string } | void>;
  accent?: string;
  /** Nome exibido na avaliação (mascarado depois). */
  customerName: string;
  className?: string;
  onSuccess?: () => void;
}

/**
 * Formulário de avaliação. A validação local roda antes do envio para o cliente
 * receber o erro na hora, sem depender do banco.
 */
export function ReviewSubmitForm({
  onSubmit,
  accent = "#06b6d4",
  customerName,
  className,
  onSuccess,
}: ReviewSubmitFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const message = validateReviewInput({ rating, comment });
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await onSubmit({ rating, comment: comment.trim() });
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSuccess?.();
    } catch {
      setError("Não foi possível enviar sua avaliação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <RatingInput value={rating} onChange={setRating} accent={accent} />

      <textarea
        value={comment}
        maxLength={MAX_COMMENT_LENGTH}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Conte como foi (opcional)"
        className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-white/25 focus:outline-none"
      />

      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-gray-600">
          {comment.length}/{MAX_COMMENT_LENGTH}
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: accent }}
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          {submitting ? "Enviando…" : "Enviar avaliação"}
        </button>
      </div>

      {error && <p className="text-xs font-semibold text-red-300">{error}</p>}
      <p className="text-[10px] text-gray-600">
        Sua avaliação será publicada como{" "}
        <span className="font-semibold text-gray-400">{customerName}</span>.
      </p>
    </div>
  );
}
