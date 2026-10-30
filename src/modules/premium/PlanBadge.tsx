import { Crown, Sparkles } from "lucide-react";
import { usePlan } from "@/modules/premium/plan-context";
import { MONTHLY_FREE_LIMIT } from "@/modules/supabase/subscription";
import { cn } from "@/lib/utils";

/** Horas restantes até `iso` (negativo quando já venceu). */
function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

/**
 * Selo do plano atual, no cabeçalho de toda tela autenticada.
 *
 * Gratuito fica em tom neutro/âmbar e mostra a cota restante; Premium troca
 * para dourado com brilho e passa a contar os dias até o vencimento — o dono
 * vê onde está sem abrir a tela de assinatura.
 */
export function PlanBadge({ onClick, className }: { onClick?: () => void; className?: string }) {
  const { status, loading } = usePlan();

  if (loading || !status) return null;

  const premium = status.isPremium;
  const hoursLeft = status.premiumExpiresAt ? hoursUntil(status.premiumExpiresAt) : null;
  // No gratuito, o que importa é a cota: 0 ou 1 restante já é atenção.
  const lowQuota = !premium && status.remainingOrders <= 1;

  const label = premium ? "Premium" : "Grátis";
  // `isPremium` já é false depois do vencimento, então aqui só há tempo restante.
  const detail = premium
    ? hoursLeft === null
      ? "ativo"
      : hoursLeft <= 24
        ? "vence hoje"
        : `${Math.ceil(hoursLeft / 24)}d`
    : `${status.remainingOrders}/${status.monthlyLimit || MONTHLY_FREE_LIMIT}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={
        premium
          ? hoursLeft !== null
            ? `Premium ativo — vence em ${Math.ceil(hoursLeft / 24)} dia(s)`
            : "Premium ativo"
          : `Plano gratuito — ${status.remainingOrders} pedidos restantes`
      }
      className={cn(
        "plan-badge inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-transform active:scale-95",
        premium
          ? "plan-badge-premium border-amber-400/35 bg-gradient-to-r from-amber-500/20 to-amber-400/10 text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.18)]"
          : lowQuota
            ? "plan-badge-free border-amber-400/30 bg-amber-500/10 text-amber-300"
            : "plan-badge-free border-white/10 bg-white/[0.04] text-gray-400 hover:text-gray-200",
        className,
      )}
    >
      {premium ? (
        <Crown className="size-3.5 text-amber-300" />
      ) : (
        <span className="plan-dot size-1.5 rounded-full bg-current" aria-hidden />
      )}
      {premium && <Sparkles className="size-3 text-amber-300/80" aria-hidden />}
      <span>{label}</span>
      <span className={premium ? "text-amber-300/70" : "text-current opacity-60"}>{detail}</span>
    </button>
  );
}
