import type { ComponentType, ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Rótulo acessível quando o placeholder não basta como descrição. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Campo de busca único do app.
 *
 * Antes cada aba montava o próprio input com o mesmo `rounded-xl border-white/10`
 * repetido — aqui a aparência é uma só e o foco (borda ciano) já vem resolvido.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: SearchFieldProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 transition-colors focus:border-cyan-500/50 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
      />
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  key: T;
  label: ReactNode;
  /** Contagem opcional exibida como selo dentro do segmento. */
  count?: number;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Filtro segmentado: uma linha de botões em que só o ativo fica aceso.
 *
 * Substitui os dois blocos de botões (Pedidos e Clientes) que repetiam a mesma
 * lógica de estado ativo/inativo. A contagem aparece como selo no segmento para
 * o operador saber o volume antes de tocar.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-all",
              active
                ? "bg-cyan-500 text-black shadow-[0_4px_16px_rgba(6,182,212,0.25)]"
                : "text-gray-400 hover:bg-white/[0.05] hover:text-gray-200",
            )}
          >
            <span className="truncate">{option.label}</span>
            {option.count != null && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 text-[10px] tabular-nums",
                  active ? "bg-black/20 text-black" : "bg-white/10 text-gray-400",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface HeaderIconButtonProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  /** Realce ciano para ações ligadas (som, cozinha); neutro por padrão. */
  tone?: "neutral" | "cyan";
  disabled?: boolean;
  /** Gira o ícone — usado no "atualizar" enquanto carrega. */
  spinning?: boolean;
  className?: string;
}

/**
 * Botão de ação do cabeçalho de aba: alvo quadrado de 40px, um só por ação.
 *
 * Os cabeçalhos do mobile repetiam essa classe inteira em cada botão; agora a
 * altura, o raio e os estados de foco/hover vivem em um lugar só.
 */
export function HeaderIconButton({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
  disabled,
  spinning,
  className,
}: HeaderIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl border transition-colors disabled:opacity-50",
        tone === "cyan"
          ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
          : "border-white/[0.08] bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white",
        className,
      )}
    >
      <Icon className={cn("size-5", spinning && "animate-spin")} />
    </button>
  );
}
