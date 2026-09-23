import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className={cn("flex h-screen bg-[#0a0a0f]", className)}>
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
