import { Link } from "@tanstack/react-router";
import { Crown, Gift, Sparkles, Timer, Zap } from "lucide-react";
import { useCountdown } from "@/hooks/useCountdown";
import { cn } from "@/lib/utils";

interface PremiumUsageMeterProps {
  /** Pedidos já usados no mês (derivado de `orders`, à prova de adulteração). */
  used: number;
  /** Cota do plano gratuito (ex.: 5), sem contar bônus. */
  bonus?: number;
  limit: number;
  /** Assinante não vê termômetro: mostra o estado Premium. */
  isPremium?: boolean;
  /** Diária de 24h em vigor. */
  dayPassActive?: boolean;
  /** Fim da diária (ISO) — alimenta o cronômetro HH:MM:SS. */
  dayPassUntil?: string | null;
  /** Diárias ganhas por recompensa, ainda não usadas. */
  dayPassCredits?: number;
  /** Para onde leva o convite de upgrade. */
  to?: string;
  className?: string;
}

/**
 * Termômetro de uso do plano gratuito.
 *
 * Transforma o limite de 5 pedidos em leitura instantânea: uma barra
 * segmentada que enche conforme o dono usa a cota. A cor acompanha o estado
 * (ciano → âmbar → vermelho) para o aviso aparecer antes de o bloqueio
 * acontecer, sem modal nem pop-up. É convite, não obstáculo.
 */
export function PremiumUsageMeter({
  used,
  limit,
  bonus = 0,
  isPremium = false,
  dayPassActive = false,
  dayPassUntil = null,
  dayPassCredits = 0,
  to = "/admin/assinatura",
  className,
}: PremiumUsageMeterProps) {
  const safeLimit = Math.max(1, limit + Math.max(0, bonus));
  const clampedUsed = Math.max(0, Math.min(used, safeLimit));
  const remaining = Math.max(0, safeLimit - clampedUsed);
  const ratio = clampedUsed / safeLimit;
  const countdown = useCountdown(dayPassUntil, dayPassActive);

  if (isPremium) {
    return (
      <div
        className={cn(
          "glow-cyan flex items-center gap-3 rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-500/[0.08] to-cyan-500/[0.06] p-4",
          className,
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
          <Crown className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-100">Premium ativo</p>
          <p className="mt-0.5 text-xs text-amber-200/70">
            Pedidos ilimitados — sem limite mensal.
          </p>
        </div>
        <Zap className="size-4 shrink-0 text-amber-300/70" />
      </div>
    );
  }

  // Diária em vigor: o que importa é o tempo restante, não a cota do mês.
  if (dayPassActive) {
    return (
      <div
        className={cn(
          "glow-cyan flex items-center gap-3 rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/[0.08] to-cyan-500/[0.03] p-4",
          className,
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-400/15 text-cyan-300">
          <Timer className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-cyan-100">Acesso por 24h ativo</p>
          <p className="mt-0.5 text-xs text-cyan-200/70">
            Pedidos ilimitados enquanto o contador estiver rodando.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-cyan-500/15 px-2.5 py-1 font-mono text-[13px] font-bold tabular-nums text-cyan-200">
          {countdown ?? "--:--:--"}
        </span>
      </div>
    );
  }

  const nearLimit = remaining <= 2;
  const full = remaining === 0;

  const fillClass = full
    ? "from-red-500 to-red-400"
    : nearLimit
      ? "from-amber-500 to-amber-400"
      : "from-cyan-500 to-cyan-300";

  return (
    <Link
      to={to}
      className={cn(
        "tap block rounded-2xl border p-4 transition-colors",
        full
          ? "glow-cyan-live border-red-500/25 bg-red-500/[0.06] hover:bg-red-500/[0.1]"
          : nearLimit
            ? "border-amber-500/25 bg-amber-500/[0.05] hover:bg-amber-500/[0.09]"
            : "border-white/[0.08] bg-white/[0.02] hover:border-cyan-400/25 hover:bg-white/[0.04]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            full
              ? "bg-red-500/15 text-red-300"
              : nearLimit
                ? "bg-amber-500/15 text-amber-300"
                : "bg-cyan-500/15 text-cyan-300",
          )}
        >
          {full || nearLimit ? <Crown className="size-4" /> : <Sparkles className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Plano gratuito</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {full
              ? "Cota do mês esgotada — assine para liberar tudo."
              : `${clampedUsed} de ${safeLimit} pedidos usados neste mês`}
          </p>
          {bonus > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              <Gift className="size-3" /> +{bonus} bônus conquistado{bonus === 1 ? "" : "s"}
            </p>
          )}
          {dayPassCredits > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-cyan-500/12 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
              <Timer className="size-3" /> {dayPassCredits} diária{dayPassCredits === 1 ? "" : "s"}{" "}
              grátis disponível{dayPassCredits === 1 ? "" : "eis"}
            </p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums",
            full
              ? "bg-red-500/15 text-red-300"
              : nearLimit
                ? "bg-amber-500/15 text-amber-300"
                : "bg-cyan-500/15 text-cyan-300",
          )}
        >
          {clampedUsed}/{safeLimit}
        </span>
      </div>

      {/* Termômetro: um segmento por pedido da cota. Fica claro de relance
          quantos ainda restam, sem precisar ler o número. */}
      <div
        className="mt-3 flex items-center gap-1.5"
        role="img"
        aria-label={`${clampedUsed} de ${safeLimit} pedidos usados`}
      >
        {Array.from({ length: safeLimit }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-500",
              i < clampedUsed ? cn("bg-gradient-to-r", fillClass) : "bg-white/[0.07]",
            )}
          />
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="text-[11px] text-gray-500">
          {full
            ? "Pedidos continuam chegando"
            : remaining <= 2
              ? `Restam ${remaining} pedido${remaining === 1 ? "" : "s"}`
              : "Assine Premium para ilimitado"}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-bold",
            full ? "text-red-300" : nearLimit ? "text-amber-300" : "text-cyan-300",
          )}
        >
          {ratio >= 0.6 ? "Assinar" : "Ver Premium"}
          <Zap className="size-3" />
        </span>
      </div>
    </Link>
  );
}
