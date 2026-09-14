import { brl } from "@/lib/utils";
import { Wallet, ShoppingBag, TrendingUp, Ban, Award, ArrowUpRight, ArrowDownRight, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type FinanceMetrics = {
  totalOrders: number;
  totalRevenue: number;
  cancelledRevenue: number;
  averageTicket: number;
  deliveredCount: number;
  cancelledCount: number;
  receivedCount: number;
  preparingCount: number;
};

const TIPS = {
  revenue: "Faturamento é a soma dos totais de pedidos não cancelados. Não é saldo bancário e não considera taxas de gateway.",
  ticket: "Ticket médio = faturamento ÷ pedidos não cancelados.",
  delivered: "Quantidade de pedidos com status 'entregue' no período.",
  cancelled: "Pedidos cancelados nunca entram no faturamento. Perda potencial = soma dos totais cancelados.",
};

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-white/5 text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-300"
            aria-label="Mais informações"
          >
            <HelpCircle className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-[260px] border-white/10 bg-[#1a1a22] text-xs leading-relaxed text-gray-300"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function FinanceSummary({ metrics }: { metrics: FinanceMetrics; subtitle?: string }) {
  const cards = [
    {
      label: "Faturamento",
      value: brl(metrics.totalRevenue),
      sub: `${metrics.totalOrders - metrics.cancelledCount} pedidos`,
      icon: Wallet,
      tone: "cyan" as const,
      tip: TIPS.revenue,
    },
    {
      label: "Ticket médio",
      value: brl(metrics.averageTicket),
      sub: "por pedido",
      icon: Award,
      tone: "violet" as const,
      tip: TIPS.ticket,
    },
    {
      label: "Entregues",
      value: String(metrics.deliveredCount),
      sub: metrics.totalOrders ? `${((metrics.deliveredCount / metrics.totalOrders) * 100).toFixed(0)}% do total` : "—",
      icon: TrendingUp,
      tone: "emerald" as const,
      tip: TIPS.delivered,
    },
    {
      label: "Cancelados",
      value: String(metrics.cancelledCount),
      sub: metrics.cancelledRevenue ? brl(metrics.cancelledRevenue) : "sem perda",
      icon: Ban,
      tone: "red" as const,
      tip: TIPS.cancelled,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {cards.map((c) => {
        const toneClasses =
          c.tone === "cyan"
            ? "bg-cyan-500/15 text-cyan-300"
            : c.tone === "violet"
              ? "bg-violet-500/15 text-violet-300"
              : c.tone === "emerald"
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-red-500/15 text-red-300";

        return (
          <div
            key={c.label}
            className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5 sm:p-4"
          >
            <div className="flex items-start justify-between gap-1.5">
              <div className={`grid size-7 shrink-0 place-items-center rounded-lg ${toneClasses}`}>
                <c.icon className="size-3.5" />
              </div>
              <HelpTip text={c.tip} />
            </div>
            <div className="mt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{c.label}</p>
              <p className="mt-0.5 text-lg font-black leading-tight text-white sm:text-xl">{c.value}</p>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">{c.sub}</p>
          </div>
        );
      })}

      {/* secondary pills */}
      <div className="col-span-2 flex flex-wrap items-center gap-1.5 text-[11px] lg:col-span-4">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-gray-400">
          <ShoppingBag className="size-3" /> Total: <strong className="text-white">{metrics.totalOrders}</strong>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-sky-200">
          <ArrowDownRight className="size-3" /> Recebidos: <strong>{metrics.receivedCount}</strong>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-200">
          <ArrowUpRight className="size-3" /> Preparo: <strong>{metrics.preparingCount}</strong>
        </span>
      </div>
    </div>
  );
}
