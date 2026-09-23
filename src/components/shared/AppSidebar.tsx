import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function AppSidebar({ isOpen, onClose, children, className }: AppSidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "flex h-full w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0c0c14] transition-transform duration-300",
          "absolute z-50 lg:relative lg:z-0 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          className,
        )}
      >
        {children}
      </aside>
    </>
  );
}
