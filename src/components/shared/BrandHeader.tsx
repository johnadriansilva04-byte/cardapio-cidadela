import { UtensilsCrossed, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface BrandHeaderProps {
  showClose?: boolean;
  onClose?: () => void;
  compact?: boolean;
  className?: string;
}

export function BrandHeader({ showClose, onClose, compact = false, className }: BrandHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3 px-5 pb-4 pt-5", className)}>
      <Link to="/" className="flex items-center gap-2">
        <span
          className={cn(
            "grid place-items-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/10 ring-1 ring-white/10",
            compact ? "size-7" : "size-9",
          )}
        >
          <UtensilsCrossed
            className={cn("text-cyan-400", compact ? "size-3.5" : "size-4")}
          />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-bold tracking-tight",
              compact ? "text-sm" : "text-sm",
            )}
          >
            Cardápio <span className="text-cyan-400">Cidadela</span>
          </p>
          {!compact && (
            <p className="truncate text-[10px] text-gray-600">Painel de gestão</p>
          )}
        </div>
      </Link>
      {showClose && onClose && (
        <button
          onClick={onClose}
          className="ml-auto grid size-8 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Fechar menu"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
