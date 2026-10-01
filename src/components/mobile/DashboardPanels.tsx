import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, Clock, TrendingUp, Users } from "lucide-react";
import { ExpandableSection, StatTile } from "@/modules/ui/ExpandableSection";
import { EmptyState } from "@/modules/ui/Feedback";
import { STATUS_LABELS, computeMetrics, dailyRevenue } from "@/modules/mobile/orders";
import { OrderStatusBadge } from "@/components/admin/StatusBadge";
import type { Order, Restaurant } from "@/lib/types";
import { brl, cn } from "@/lib/utils";

export function DashboardPanels({
  orders,
  restaurants,
  restaurantNames,
}: {
  orders: Order[];
  restaurants: Restaurant[];
  restaurantNames: Map<string, string>;
}) {
  const metrics = useMemo(() => computeMetrics(orders, restaurantNames), [orders, restaurantNames]);
  const week = useMemo(() => dailyRevenue(orders, 7), [orders]);
  const bestDay = week.reduce((best, day) => (day.value > best.value ? day : best), week[0]);

  const recentFinished = useMemo(
    () =>
      orders
        .filter((order) => order.status === "delivered" || order.status === "cancelled")
        .slice(0, 8),
    [orders],
  );

  const maxDayValue = Math.max(...week.map((day) => day.value), 1);
  const weekTotal = week.reduce((sum, day) => sum + day.value, 0);
  const todayKey = week[week.length - 1]?.key;

  return (
    <>
      {/* Resumo financeiro em uma linha: os três números que o dono confere
          primeiro, no mesmo cartão, sem precisar abrir nada. */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile
          label="Hoje"
          value={brl(metrics.todayRevenue)}
          hint={`${metrics.todayOrders} pedido${metrics.todayOrders === 1 ? "" : "s"}`}
          icon={<TrendingUp className="size-3.5" />}
          tone="cyan"
        />
        <StatTile
          label="7 dias"
          value={brl(weekTotal)}
          hint="Faturamento do período"
          icon={<Calendar className="size-3.5" />}
          tone="violet"
        />
        <StatTile
          label="Ticket"
          value={brl(metrics.averageTicket)}
          hint={`${metrics.totalOrders} no total`}
          icon={<Users className="size-3.5" />}
          tone="emerald"
        />
      </div>

      <ExpandableSection
        icon={<Calendar className="size-5" />}
        tone="cyan"
        title="Faturamento dos últimos 7 dias"
        summary={`${brl(weekTotal)} no período · melhor ${bestDay?.label}`}
        defaultOpen
      >
        <div className="space-y-2.5">
          {week.map((day) => {
            const isToday = day.key === todayKey;
            return (
              <div key={day.key} className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-10 shrink-0 text-[11px] font-semibold",
                    isToday ? "text-cyan-300" : "text-gray-500",
                  )}
                >
                  {isToday ? "Hoje" : day.label}
                </span>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      isToday
                        ? "bg-gradient-to-r from-cyan-400 to-cyan-300"
                        : "bg-gradient-to-r from-cyan-500/70 to-cyan-400/70",
                    )}
                    style={{ width: `${Math.max(2, (day.value / maxDayValue) * 100)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-[11px] font-bold tabular-nums text-gray-300">
                  {brl(day.value)}
                </span>
              </div>
            );
          })}
          <p className="pt-1 text-[11px] text-gray-500">
            Melhor dia: {bestDay?.label} com {brl(bestDay?.value ?? 0)}.
          </p>
        </div>
      </ExpandableSection>

      <ExpandableSection
        icon={<Clock className="size-5" />}
        title="Situação dos pedidos"
        summary={`${metrics.activeCount} em andamento · ${metrics.finishedCount} entregues · ${metrics.cancelledCount} cancelados`}
      >
        {metrics.statusDistribution.length === 0 ? (
          <p className="text-xs text-gray-500">Nenhum pedido registrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {metrics.statusDistribution.map((entry) => {
              // Escala pelo maior grupo, não pelo total: a maior barra sempre
              // encosta na direita e a leitura comparativa fica imediata.
              const peak = Math.max(...metrics.statusDistribution.map((item) => item.value), 1);
              return (
                <div key={entry.status} className="flex items-center gap-3">
                  <span className="w-24 shrink-0">
                    <OrderStatusBadge status={entry.status} size="xs" />
                  </span>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-white/25 to-white/40"
                      style={{ width: `${(entry.value / peak) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-gray-300">
                    {entry.value}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </ExpandableSection>

      {restaurants.length > 1 && (
        <ExpandableSection
          icon={<TrendingUp className="size-5" />}
          title="Desempenho por loja"
          summary={`${restaurants.length} lojas conectadas`}
        >
          <div className="space-y-2">
            {metrics.topRestaurants.map((store) => (
              <div
                key={store.name}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-white">{store.name}</p>
                  <p className="text-[11px] text-gray-500">
                    {store.orders} pedido{store.orders === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold text-cyan-300">
                  {brl(store.revenue)}
                </span>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      <ExpandableSection
        icon={<Clock className="size-5" />}
        title="Últimos pedidos concluídos"
        summary={`${recentFinished.length} registros recentes`}
      >
        {recentFinished.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Nada concluído ainda"
            description="Os pedidos entregues e cancelados aparecem aqui como histórico."
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <ul className="space-y-2">
            {recentFinished.map((order) => (
              <li key={order.id} className="flex items-center gap-3">
                <OrderStatusBadge status={order.status} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-200">
                    {order.comanda} · {order.customer_name}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {new Date(order.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {STATUS_LABELS[order.status]}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold text-gray-300">
                  {brl(Number(order.total))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ExpandableSection>

      <p className="px-1 text-[11px] leading-relaxed text-gray-500">
        Quer o detalhamento por período e exportação em CSV?{" "}
        <Link to="/admin/financeiro" className="font-semibold text-cyan-300 hover:underline">
          Abra o financeiro no painel completo
        </Link>
        .
      </p>
    </>
  );
}
