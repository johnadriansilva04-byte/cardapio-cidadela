import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  /** Linha de contexto sob o título — o "onde estou" que o operador lê de relance. */
  subtitle?: ReactNode;
  /** Ações à direita (atualizar, novo, som). */
  actions?: ReactNode;
  /** Faixa de destaque abaixo do título (métricas, status da loja). */
  meta?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho de página único.
 *
 * Antes cada aba repetia seu próprio título e subtítulo com espaçamentos
 * diferentes; aqui a hierarquia é uma só: título, contexto e ações alinhados
 * na mesma linha de base.
 */
export function PageHeader({ title, subtitle, actions, meta, className }: PageHeaderProps) {
  return (
    <header className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {meta}
    </header>
  );
}

export interface StoreStatusBadgeProps {
  open: boolean;
  /** Ex.: "fechado às 22h" — complemento curto ao lado do estado. */
  hint?: ReactNode;
  className?: string;
}

/** Estado aberto/fechado da loja: um selo só, reutilizado em todas as telas. */
export function StoreStatusBadge({ open, hint, className }: StoreStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
        open
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
        className,
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", open ? "bg-emerald-400" : "bg-zinc-500")}
        aria-hidden
      />
      {open ? "Aberto agora" : "Fechado agora"}
      {hint && <span className="font-medium text-gray-400">· {hint}</span>}
    </span>
  );
}
