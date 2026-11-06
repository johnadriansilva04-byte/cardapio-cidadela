import type { ReactNode } from "react";
import { Check, Sparkles } from "lucide-react";
import { PLANS, PLAN_ORDER, PLAN_FEATURES, type PlanDefinition, type PlanKey } from "@/lib/plans";

/**
 * Cartões dos pacotes (Gratuito, Mensal, Anual) — fonte única.
 *
 * A landing e a tela de assinatura renderizam daqui, então o marketing nunca
 * diverge do que a assinatura entrega: mudar um recurso é mexer em `plans.ts`.
 * O CTA é injetado por quem usa (`renderCta`), porque na landing é um link e na
 * assinatura é um botão que abre o Mercado Pago.
 */
export function PlanCards({
  highlight = "annual",
  renderCta,
  className,
}: {
  highlight?: PlanKey | null;
  renderCta: (plan: PlanDefinition) => ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "grid gap-5 sm:grid-cols-3"}>
      {PLAN_ORDER.map((key) => {
        const plan = PLANS[key];
        const isHighlight = key === highlight;
        return (
          <div
            key={plan.key}
            className={
              "relative flex flex-col rounded-3xl border p-7 " +
              (isHighlight
                ? "border-cyan-500/40 bg-gradient-to-b from-cyan-500/[0.12] to-transparent shadow-[0_0_60px_-20px_rgba(34,211,238,0.5)]"
                : "border-white/[0.07] bg-white/[0.02]")
            }
          >
            {isHighlight && (
              <div
                aria-hidden
                className="pointer-events-none absolute -right-14 -top-14 size-44 rounded-full bg-cyan-500/25 blur-3xl"
              />
            )}
            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between">
                <p
                  className={
                    "text-xs font-bold uppercase tracking-widest " +
                    (isHighlight ? "text-cyan-300" : "text-gray-500")
                  }
                >
                  {plan.name}
                </p>
                {plan.badge && (
                  <span className="rounded-full bg-cyan-500 px-2.5 py-1 text-[10px] font-black text-black">
                    {plan.badge}
                  </span>
                )}
              </div>
              <p className="mt-3 text-4xl font-black text-white">{plan.priceLabel}</p>
              <p className="mt-1 text-sm text-gray-400">
                {plan.monthlyEquivalent ? (
                  <>
                    equivale a {plan.monthlyEquivalent} por mês · {plan.tagline}
                  </>
                ) : (
                  plan.tagline
                )}
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-gray-200">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check
                      className={
                        "mt-0.5 size-4 shrink-0 " +
                        (isHighlight ? "text-cyan-300" : "text-emerald-400")
                      }
                    />
                    <span>{PLAN_FEATURES[feature]}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">{renderCta(plan)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Linha da tabela comparativa (Gratuito × Mensal × Anual). */
export interface PlanComparisonRow {
  feature: string;
  free: ReactNode;
  monthly: ReactNode;
  annual: ReactNode;
}

/** Marca de "tem" com o mesmo desenho em toda a tabela. */
export function PlanCheck() {
  return <Check className="size-3.5 shrink-0 text-emerald-400" />;
}

/** "Sem" na tabela, para não poluir de "—" repetidos. */
export function PlanNo({ exclusive }: { exclusive?: boolean }) {
  return exclusive ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
      <Sparkles className="size-3" /> Anual
    </span>
  ) : (
    <span className="text-gray-600">—</span>
  );
}
