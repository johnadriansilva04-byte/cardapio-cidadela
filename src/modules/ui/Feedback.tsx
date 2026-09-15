import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Estado vazio padrão: explica o que aconteceria aqui e como sair dele. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center",
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-white/[0.04]">
        <Icon className="size-6 text-gray-500" />
      </span>
      <p className="mt-4 text-sm font-semibold text-gray-300">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

/** Erro recuperável no corpo da página, sem ocupar a tela inteira. */
export function InlineError({ message, onRetry, retrying }: InlineErrorProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-red-500/15 text-sm font-bold text-red-300">
        !
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-200">{message}</p>
        <p className="mt-0.5 text-xs text-red-200/70">Verifique sua conexão e tente novamente.</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="shrink-0 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200 transition-colors hover:bg-red-500/20 disabled:opacity-50"
        >
          {retrying ? "Tentando…" : "Tentar de novo"}
        </button>
      )}
    </div>
  );
}
