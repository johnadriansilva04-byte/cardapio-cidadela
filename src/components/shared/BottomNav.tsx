import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "./Badge";

interface BottomNavItem {
  id: string;
  label: string;
  icon: LucideIcon | ComponentType<{ className?: string }>;
  to: string;
  badge?: number;
}

interface BottomNavProps {
  items: BottomNavItem[];
  activeId: string;
  accent?: string;
  className?: string;
}

export function BottomNav({ items, activeId, accent = "#06b6d4", className }: BottomNavProps) {
  return (
    <nav
      aria-label="Navegação inferior"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-[#0c0c14]/95 backdrop-blur-xl lg:hidden",
        className,
      )}
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <Link
              key={item.id}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ className: "text-cyan-300" }}
              inactiveProps={{ className: "text-gray-500" }}
              className="relative flex flex-1 flex-col items-center gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 text-[10px] font-semibold transition-colors"
            >
              <span className="relative">
                <item.icon className="size-5" />
                {item.badge != null && item.badge > 0 && (
                  <Badge count={item.badge} max={9} variant="small" className="absolute -right-2.5 -top-1.5" />
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
