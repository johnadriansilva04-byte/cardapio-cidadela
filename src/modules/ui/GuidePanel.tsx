import type { ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const WIDTH: Record<NonNullable<GuidePanelProps["width"]>, string> = {
  md: "sm:max-w-md",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-5xl",
};

export interface GuidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Ícone à esquerda do título. */
  icon?: ReactNode;
  /** Tom do ícone (casa com as cores do app). */
  tone?: "cyan" | "violet" | "emerald" | "amber";
  /** Largura no desktop; no celular ocupa a tela inteira. */
  width?: "md" | "lg" | "xl";
  /** Descrição curta sob o título (opcional). */
  description?: ReactNode;
  children: ReactNode;
}

const TONE: Record<NonNullable<GuidePanelProps["tone"]>, string> = {
  cyan: "bg-cyan-500/15 text-cyan-300",
  violet: "bg-violet-500/15 text-violet-300",
  emerald: "bg-emerald-500/15 text-emerald-300",
  amber: "bg-amber-500/15 text-amber-300",
};

/**
 * Guia que abre por cima da tela, com X para fechar.
 *
 * O conteúdo rola por dentro (o `overflow-y-auto` fica no corpo), enquanto o
 * Radix Dialog trava o scroll da página atrás — o operador nunca "perde" o
 * botão de ação rolando a tela. É o mesmo padrão usado em `/admin/assinatura`,
 * extraído aqui para as outras telas não reinventarem o cabeçalho e o botão.
 */
export function GuidePanel({
  open,
  onOpenChange,
  title,
  icon,
  tone = "cyan",
  width = "lg",
  description,
  children,
}: GuidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // `[&>button]:hidden` esconde o X padrão do Sheet: o fechamento daqui
        // tem o próprio botão, com rótulo em pt-BR.
        className={cn(
          "flex w-full flex-col gap-0 border-white/10 bg-[#0b0b10] p-0 text-white [&>button]:hidden",
          WIDTH[width],
        )}
      >
        <header className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
          {icon && (
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", TONE[tone])}>
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-black tracking-tight text-white">
              {title}
            </SheetTitle>
            {description && (
              <p className="mt-0.5 truncate text-[11px] text-gray-400">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

const TILE_TONE: Record<NonNullable<GuideTileProps["tone"]>, string> = {
  cyan: "bg-cyan-500/15 text-cyan-300",
  violet: "bg-violet-500/15 text-violet-300",
  emerald: "bg-emerald-500/15 text-emerald-300",
  amber: "bg-amber-500/15 text-amber-300",
  red: "bg-red-500/15 text-red-300",
};

export interface GuideTileProps {
  icon: ReactNode;
  title: string;
  /** Linha de apoio (valor atual, resumo). */
  hint?: ReactNode;
  /** Selo à direita do título (status, contagem). */
  badge?: ReactNode;
  tone?: "cyan" | "violet" | "emerald" | "amber" | "red";
  /** `sm` para telas que precisam caber numa altura só (hub de assinatura). */
  size?: "md" | "sm";
  onClick: () => void;
}

/**
 * Atalho que abre uma guia. Substitui o acordeão: em vez de esticar a página
 * (que empurrava o resto para baixo), o toque abre o painel por cima.
 */
export function GuideTile({
  icon,
  title,
  hint,
  badge,
  tone = "cyan",
  size = "md",
  onClick,
}: GuideTileProps) {
  const compact = size === "sm";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] text-left transition-colors hover:bg-white/[0.05]",
        compact ? "p-2.5 hover:border-white/15" : "p-3.5",
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-xl",
          compact ? "size-9" : "size-10",
          TILE_TONE[tone],
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-white">{title}</span>
          {badge}
        </span>
        {hint && (
          <span
            className={cn(
              "mt-0.5 block truncate text-gray-400",
              compact ? "text-[11px]" : "text-xs",
            )}
          >
            {hint}
          </span>
        )}
      </span>
      <ChevronRight className="size-4 shrink-0 text-gray-600" aria-hidden="true" />
    </button>
  );
}
