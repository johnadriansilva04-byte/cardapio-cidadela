import { cn } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string;
  height?: string;
  style?: React.CSSProperties;
}

/**
 * Componente de skeleton loading para estados de carregamento.
 * Usado para melhorar a UX enquanto dados estão sendo carregados.
 */
export function Skeleton({
  className,
  variant = "rectangular",
  width,
  height,
  style,
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-white/5",
        variant === "circular" && "rounded-full",
        variant === "text" && "h-4 w-full rounded-md",
        className
      )}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton específico para cards de restaurante.
 */
export function RestaurantCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex gap-3">
        <Skeleton variant="circular" width="48px" height="48px" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="h-5 w-3/4" />
          <Skeleton variant="text" className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton específico para cards de produto no cardápio.
 */
export function ProductCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <Skeleton variant="rectangular" width="100%" height="120px" className="mb-3" />
      <Skeleton variant="text" className="h-5 w-3/4 mb-2" />
      <Skeleton variant="text" className="h-4 w-1/2" />
    </div>
  );
}

/**
 * Skeleton específico para seção de avaliações.
 */
export function ReviewSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width="32px" height="32px" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="h-4 w-1/3" />
          <Skeleton variant="text" className="h-3 w-2/3" />
        </div>
      </div>
      <Skeleton variant="text" className="h-16 w-full" />
    </div>
  );
}
