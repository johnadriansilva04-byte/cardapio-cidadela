import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_RATING } from "@/lib/reviews";

export interface StarRatingProps {
  /** Nota atual. Frações são arredondadas para a estrela cheia mais próxima. */
  value: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Rótulo acessível; sem ele o leitor de tela anuncia a nota. */
  label?: string;
}

const SIZE_CLASSES = {
  sm: "size-3",
  md: "size-4",
  lg: "size-5",
} as const;

/** Estrelas somente-leitura. Não intercepta clique — para isso use RatingInput. */
export function StarRating({ value, size = "sm", className, label }: StarRatingProps) {
  const filled = Math.round(value);
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={label ?? `Nota ${filled} de ${MAX_RATING}`}
    >
      {Array.from({ length: MAX_RATING }, (_, i) => (
        <Star
          key={i}
          className={cn(
            SIZE_CLASSES[size],
            i < filled ? "fill-yellow-400 text-yellow-400" : "text-gray-600",
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
