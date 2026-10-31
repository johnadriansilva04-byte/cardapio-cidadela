import { Check, ChevronsUpDown, Store } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useActiveStore } from "@/modules/store/active-store-context";

/**
 * Loja ativa no cabeçalho de toda tela do painel.
 *
 * Existe para o dono com mais de uma loja nunca ficar na dúvida sobre "de qual
 * loja é esta tela": o nome fica visível o tempo todo e a troca acontece em
 * qualquer lugar, sem voltar ao dashboard. Com uma loja só não renderiza nada —
 * repetir o nome seria ruído.
 */
export function StoreSwitcher({ className }: { className?: string }) {
  const { restaurants, active, setActiveId } = useActiveStore();
  if (restaurants.length < 2 || !active) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-w-0 max-w-[46vw] items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/[0.09] sm:max-w-none",
            className,
          )}
          aria-label={`Loja ativa: ${active.name}. Trocar loja`}
        >
          <Store className="size-3.5 shrink-0 text-cyan-300" />
          <span className="truncate">{active.name}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-gray-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60 border-white/10 bg-[#1a1a22] text-white">
        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Trocar de loja
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {restaurants.map((r) => {
          const isActive = r.id === active.id;
          return (
            <DropdownMenuItem
              key={r.id}
              onSelect={() => setActiveId(r.id)}
              className={cn(
                "gap-2 text-sm",
                isActive ? "font-bold text-cyan-300" : "text-gray-200",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              {r.status !== "published" && (
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-400/80">
                  pausada
                </span>
              )}
              {isActive && <Check className="size-4 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
