import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpaceBackdrop } from "./SpaceBackdrop";

interface AppLayoutProps {
  children: ReactNode;
  loading?: boolean;
  sidebar?: ReactNode;
  header?: ReactNode;
  className?: string;
}

export function AppLayout({ children, loading, sidebar, header, className }: AppLayoutProps) {
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="size-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className={cn("relative flex h-screen overflow-hidden bg-[#08080e]", className)}>
      {/* Fundo espacial: fica atrás de tudo, no vão das abas. z-0 + conteúdo
          em z-10 mantém os cliques nos cards, e a sidebar (z-40) cobre a área
          dela sem deixar as estrelas vazando por cima. */}
      <SpaceBackdrop />
      <div className="relative z-10 flex h-full min-h-0 w-full">
        {sidebar}
        <div className="flex min-w-0 flex-1 flex-col">
          {header}
          <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
