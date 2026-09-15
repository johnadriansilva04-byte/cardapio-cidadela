import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExpandableTone = "neutral" | "cyan" | "violet" | "emerald" | "amber" | "red";

const TONE_ICON: Record<ExpandableTone, string> = {
  neutral: "bg-white/[0.06] text-gray-300",
  cyan: "bg-cyan-500/15 text-cyan-300",
  violet: "bg-violet-500/15 text-violet-300",
  emerald: "bg-emerald-500/15 text-emerald-300",
  amber: "bg-amber-500/15 text-amber-300",
  red: "bg-red-500/15 text-red-300",
};

const TONE_RING: Record<ExpandableTone, string> = {
  neutral: "border-white/10",
  cyan: "border-cyan-500/20",
  violet: "border-violet-500/20",
  emerald: "border-emerald-500/20",
  amber: "border-amber-500/20",
  red: "border-red-500/20",
};

export interface ExpandableSectionProps {
  title: ReactNode;
  /** Prévia sempre visível — é o que o usuário lê sem precisar expandir. */
  summary?: ReactNode;
  icon?: ReactNode;
  /** Selo compacto à direita do título (contagem, status). */
  badge?: ReactNode;
  tone?: ExpandableTone;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Rótulo do disclosure para leitores de tela, quando o trigger é só visual. */
  srLabel?: string;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: ReactNode;
}

/**
 * Bloco de conteúdo que mostra uma prévia fechada e cresce sob demanda.
 *
 * A animação usa `grid-template-rows: 0fr → 1fr`, então a altura é calculada
 * pelo navegador — sem medir o DOM nem travar em valores fixos de `max-height`.
 */
export function ExpandableSection({
  title,
  summary,
  icon,
  badge,
  tone = "neutral",
  defaultOpen = false,
  open,
  onOpenChange,
  srLabel,
  className,
  headerClassName,
  contentClassName,
  children,
}: ExpandableSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const contentId = useId();

  function toggle() {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-white/[0.02] transition-colors",
        TONE_RING[tone],
        isOpen && "bg-white/[0.035]",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className={cn(
          "flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-white/[0.03]",
          headerClassName,
        )}
      >
        {icon && (
          <span
            className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONE_ICON[tone])}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-white">{title}</span>
            {badge}
          </span>
          {summary && (
            <span className="mt-0.5 block truncate text-xs text-gray-400">{summary}</span>
          )}
          {srLabel && <span className="sr-only">{srLabel}</span>}
        </span>

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-gray-500 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id={contentId}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={cn("border-t border-white/[0.06] p-4", contentClassName)}>{children}</div>
        </div>
      </div>
    </section>
  );
}

export interface InfoRowProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** Linha rótulo/valor usada nas prévias (2 colunas, alinhadas à esquerda). */
export function InfoRow({ label, value, icon, className }: InfoRowProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-1.5", className)}>
      <span className="flex items-center gap-1.5 text-xs text-gray-500">
        {icon}
        {label}
      </span>
      <span className="min-w-0 text-right text-xs font-medium text-gray-200">{value}</span>
    </div>
  );
}

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: ExpandableTone;
  className?: string;
}

/** Cartão compacto de métrica — prévia de número grande + rótulo pequeno. */
export function StatTile({ label, value, hint, icon, tone = "cyan", className }: StatTileProps) {
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/[0.02] p-4", className)}>
      <div className="mb-2 flex items-center gap-2">
        {icon && (
          <span className={cn("grid size-6 place-items-center rounded-lg", TONE_ICON[tone])}>
            {icon}
          </span>
        )}
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {label}
        </span>
      </div>
      <p className="truncate text-xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-[10px] text-gray-500">{hint}</p>}
    </div>
  );
}
