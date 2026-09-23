import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface NavigationItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  isActive?: boolean;
  badge?: number;
  onClick?: () => void;
  accent?: string;
}

export function NavigationItem({
  to,
  label,
  icon: Icon,
  isActive = false,
  badge,
  onClick,
  accent = "#06b6d4",
}: NavigationItemProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
        isActive
          ? "bg-cyan-500/10 font-medium text-cyan-400"
          : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200",
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-cyan-400 to-cyan-600" />
      )}
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          isActive ? "text-cyan-400" : "text-gray-500 group-hover:text-gray-300",
        )}
      />
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span
          className="flex min-w-6 items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-black text-white shadow-[0_0_10px_rgba(239,68,68,0.6)]"
          title={`${badge} pedido${badge === 1 ? "" : "s"} pendente${badge === 1 ? "" : "s"}`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
