import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_RATING, ratingLabel } from "@/lib/reviews";

export interface RatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  accent?: string;
  className?: string;
}

/**
 * Seletor de estrelas acessível: cada estrela é um radio de verdade dentro de
 * um radiogroup, então teclado e leitores de tela navegam sem JS extra.
 */
export function RatingInput({ value, onChange, accent = "#06b6d4", className }: RatingInputProps) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        role="radiogroup"
        aria-label="Sua nota"
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {Array.from({ length: MAX_RATING }, (_, i) => {
          const rating = i + 1;
          const active = rating <= shown;
          return (
            <button
              key={rating}
              type="button"
              role="radio"
              aria-checked={value === rating}
              aria-label={`${rating} ${rating === 1 ? "estrela" : "estrelas"} — ${ratingLabel(rating)}`}
              onClick={() => onChange(rating)}
              onMouseEnter={() => setHover(rating)}
              onFocus={() => setHover(rating)}
              className="rounded-md p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Star
                className={cn(
                  "size-7 transition-colors",
                  active ? "fill-current" : "text-gray-600",
                )}
                style={active ? { color: accent } : undefined}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      <p className="h-4 text-xs font-semibold" style={{ color: accent }}>
        {shown > 0 ? ratingLabel(shown) : ""}
      </p>
    </div>
  );
}
