import { Gift, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RewardProgress } from "@/modules/supabase/rewards";

interface RewardsProgressProps {
  rewards: RewardProgress[];
  className?: string;
}

function formatMetric(metric: string, value: number): string {
  if (metric === "usage_seconds") {
    const hours = Math.floor(value / 3600);
    const mins = Math.floor((value % 3600) / 60);
    return hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}min` : ""}` : `${mins}min`;
  }
  return `${Math.round(value)}`;
}

function metricUnit(metric: string): string {
  return metric === "usage_seconds" ? "horas online" : "pedidos";
}

/**
 * Metas de engajamento → pedidos bônus.
 *
 * Mostra o progresso do mês rumo a cada meta e celebra as conquistadas. É o
 * rosto da recompensa "use o sistema e ganhe pedidos a mais" — sem desconto,
 * sem cupom, só cota extra.
 */
export function RewardsProgress({ rewards, className }: RewardsProgressProps) {
  if (rewards.length === 0) return null;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-5 pt-5">
        <span className="grid size-8 place-items-center rounded-xl bg-emerald-500/12 text-emerald-300">
          <Gift className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-black text-white">Ganhe pedidos bônus</h3>
          <p className="text-[11px] text-gray-500">
            Use o sistema e a cota do mês cresce sozinha. Sem custo.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5 px-5 pb-5">
        {rewards.map((r) => {
          const pct = Math.min(100, Math.round((r.progress / Math.max(1, r.threshold)) * 100));
          return (
            <li
              key={r.reward_id}
              className={cn(
                "rounded-2xl border p-3.5 transition-colors",
                r.granted
                  ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                  : "border-white/[0.07] bg-black/20",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-xl",
                      r.granted
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-cyan-500/12 text-cyan-300",
                    )}
                  >
                    {r.granted ? <Trophy className="size-4" /> : <Target className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{r.title}</p>
                    <p className="text-[11px] text-gray-500">
                      {formatMetric(r.metric, r.progress)} / {formatMetric(r.metric, r.threshold)}{" "}
                      {metricUnit(r.metric)}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black",
                    r.granted
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-cyan-500/12 text-cyan-300",
                  )}
                >
                  {r.granted ? "Conquistado" : `+${r.bonus_orders} pedidos`}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    r.granted
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                      : "bg-gradient-to-r from-cyan-500 to-cyan-300",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
