import { cn } from "@/lib/utils";

interface BadgeProps {
  count: number;
  max?: number;
  className?: string;
  variant?: "default" | "small";
}

export function Badge({ count, max = 99, className, variant = "default" }: BadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count;

  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full bg-red-500 font-black text-white shadow-[0_0_10px_rgba(239,68,68,0.6)]",
        variant === "default" && "min-w-6 px-2 py-0.5 text-[11px]",
        variant === "small" && "min-w-4 px-1 text-[9px]",
        className,
      )}
      title={`${count} pedido${count === 1 ? "" : "s"} pendente${count === 1 ? "" : "s"}`}
    >
      {displayCount}
    </span>
  );
}
