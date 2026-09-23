import { ReactNode } from "react";
import { ChevronLeft, Menu } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  showMenu?: boolean;
  onMenuClick?: () => void;
  rightContent?: ReactNode;
  className?: string;
}

export function AppHeader({
  title,
  showBack = true,
  showMenu = false,
  onMenuClick,
  rightContent,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center gap-3 border-b border-white/[0.06] bg-[#0a0a0f]/80 px-4 py-3 backdrop-blur lg:px-6",
        className,
      )}
    >
      {showMenu && (
        <button
          onClick={onMenuClick}
          className="grid size-9 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </button>
      )}

      {showBack && (
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-300"
        >
          <ChevronLeft className="size-3.5" />
          Voltar ao site
        </Link>
      )}

      {title && <h1 className="text-sm font-semibold text-white">{title}</h1>}

      <div className="ml-auto">{rightContent}</div>
    </header>
  );
}
