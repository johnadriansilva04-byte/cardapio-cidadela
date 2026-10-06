import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProgressiveListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  /** Quantos itens ficam visíveis antes de resumir o resto. */
  initial?: number;
  /** Quantos itens o "Ver mais" libera por toque. */
  step?: number;
  /** Nome do item no singular (ex.: "pedido"). */
  singular?: string;
  /** Nome do item no plural (ex.: "pedidos"). */
  plural?: string;
  /** Nome acessível do grupo, para leitores de tela. */
  ariaLabel?: string;
  className?: string;
  /** Espaçamento entre os itens visíveis. */
  gapClassName?: string;
}

/**
 * Lista que mostra os primeiros itens e resume o resto em "Ver mais N".
 *
 * Existe para telas operacionais onde o volume cresce durante o dia: o painel
 * não estica nem vira uma rolagem infinita — o operador vê o essencial e abre
 * o resto quando quer. Os itens escondidos não são montados, então 40 pedidos
 * não custam 40 cards na primeira pintura.
 */
export function ProgressiveList<T>({
  items,
  renderItem,
  initial = 2,
  step = 8,
  singular = "item",
  plural = "itens",
  ariaLabel,
  className,
  gapClassName = "space-y-2",
}: ProgressiveListProps<T>) {
  const [visible, setVisible] = useState(initial);

  const shown = items.slice(0, Math.max(initial, visible));
  const remaining = items.length - shown.length;
  const nextBatch = Math.min(step, remaining);

  return (
    <div className={className} aria-label={ariaLabel}>
      <div className={gapClassName}>{shown.map((item, index) => renderItem(item, index))}</div>

      {(remaining > 0 || visible > initial) && (
        <div className="mt-2 flex items-center gap-2">
          {remaining > 0 && (
            <button
              type="button"
              data-testid="progressive-more"
              onClick={() => setVisible((current) => current + step)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-bold text-gray-300 transition-colors hover:border-cyan-500/30 hover:bg-white/[0.06] hover:text-white"
            >
              <ChevronDown className="size-3.5" aria-hidden="true" />
              Ver mais {nextBatch} {nextBatch === 1 ? singular : plural}
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums text-gray-400">
                +{remaining}
              </span>
            </button>
          )}
          {visible > initial && (
            <button
              type="button"
              onClick={() => setVisible(initial)}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-bold text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Mostrar menos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
