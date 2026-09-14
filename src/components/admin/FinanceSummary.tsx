import { brl } from "@/lib/utils";
import { Wallet, ShoppingBag, TrendingUp, Ban, Award, ArrowUpRight, ArrowDownRight } from "lucide-react";

type FinanceMetrics = {
  totalOrders: number;
  totalRevenue: number; // delivered + outros não cancelados conforme regra abaixo
  cancelledRevenue: number;
  averageTicket: number;
  deliveredCount: number;
  cancelledCount: number;
  receivedCount: number;
  preparingCount: number;
};

export function FinanceSummary({ metrics, subtitle }: { metrics: FinanceMetrics; subtitle?: string }) {
  const cards = [
    {
      label: "Faturamento (pedidos não cancelados)",
      value: brl(metrics.totalRevenue),
      hint: `${metrics.totalOrders - metrics.cancelledCount} pedidos considerados • cancelados fora`,
      icon: Wallet,
      tone: "cyan" as const,
    },
    {
      label: "Ticket médio",
      value: brl(metrics.averageTicket),
      hint: "Média por pedido (não cancelados)",
      icon: Award,
      tone: "violet" as const,
    },
    {
      label: "Pedidos entregues",
      value: String(metrics.deliveredCount),
      hint: `${metrics.totalOrders ? ((metrics.deliveredCount / metrics.totalOrders) * 100).toFixed(0) : 0}% do total`,
      icon: TrendingUp,
      tone: "emerald" as const,
    },
    {
      label: "Cancelados",
      value: String(metrics.cancelledCount),
      hint: metrics.cancelledRevenue ? `Perda potencial ${brl(metrics.cancelledRevenue)}` : "Sem perda registrada",
      icon: Ban,
      tone: "red" as const,
    },
  ];

  return (
    <div className="space-y-3">
      {subtitle && <p className="text-xs leading-relaxed text-gray-500">{subtitle}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">{c.label}</p>
                <p className="mt-1 text-lg font-black text-white">{c.value}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{c.hint}</p>
              </div>
              <div
                className={`grid size-8 place-items-center rounded-xl ${
                  c.tone === "cyan"
                    ? "bg-cyan-500/15 text-cyan-300"
                    : c.tone === "violet"
                      ? "bg-violet-500/15 text-violet-300"
                      : c.tone === "emerald"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-red-500/15 text-red-300"
                }`}
              >
                <c.icon className="size-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-gray-400">
          <ShoppingBag className="size-3" /> Total de pedidos: <strong className="text-white">{metrics.totalOrders}</strong>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-sky-200">
          <ArrowDownRight className="size-3" /> Recebidos: <strong>{metrics.receivedCount}</strong>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-200">
          <ArrowUpRight className="size-3" /> Em preparo: <strong>{metrics.preparingCount}</strong>
        </span>
      </div>
    </div>
  );
}
