import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/types";
import { brl } from "@/lib/utils";

const STATUS_COLOR: Record<OrderStatus, string> = {
  received: "#38bdf8",
  preparing: "#f59e0b",
  ready: "#22c55e",
  out_for_delivery: "#8b5cf6",
  delivered: "#71717a",
  cancelled: "#ef4444",
};

type Props = {
  counts: Record<OrderStatus, number>;
  totalRevenue: number; // computado fora — usado no centro do donut e legenda
  totalOrders: number;
  cancelledCount?: number;
  cancelledRevenue?: number;
};

export function OrdersDonut({
  counts,
  totalOrders,
  totalRevenue,
  cancelledCount = 0,
  cancelledRevenue = 0,
}: Props) {
  const data = (Object.keys(counts) as OrderStatus[])
    .map((s) => ({
      name: ORDER_STATUS_LABELS[s],
      key: s,
      value: counts[s] ?? 0,
      color: STATUS_COLOR[s],
    }))
    .filter((d) => d.value > 0);

  if (totalOrders === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] px-4 text-center">
        <p className="text-sm text-gray-500">
          Sem pedidos ainda — o gráfico aparece assim que cair o primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="relative mx-auto h-[190px] w-[220px] shrink-0 md:mx-0 md:h-[210px] md:w-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={68}
                outerRadius={96}
                paddingAngle={2}
                stroke="rgba(255,255,255,0.08)"
                startAngle={90}
                endAngle={-270}
              >
                {data.map((e) => (
                  <Cell key={e.key} fill={e.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#0f0f14",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 12,
                }}
                formatter={(value: unknown, _name: unknown, props: unknown) => {
                  const v = Number(value ?? 0);
                  const key = (props as { payload?: { key?: OrderStatus } } | undefined)?.payload
                    ?.key;
                  const pct = totalOrders ? ((v / totalOrders) * 100).toFixed(1) : "0.0";
                  const label = key ? ORDER_STATUS_LABELS[key] : String(_name ?? "");
                  return [`${v} • ${pct}%`, label] as unknown as string;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500">
              Faturamento
            </p>
            <p className="text-base font-black text-white">{brl(totalRevenue)}</p>
            <p className="text-[10px] text-gray-500">
              {totalOrders} pedido{totalOrders === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(counts) as OrderStatus[]).map((s) => (
              <div
                key={s}
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-2.5 py-2"
              >
                <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                <span className="flex-1 truncate text-xs font-medium text-gray-300">
                  {ORDER_STATUS_LABELS[s]}
                </span>
                <span className="text-xs font-bold text-white">{counts[s] ?? 0}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px] text-gray-500">
            <span>
              Total no filtro: <span className="font-bold text-white">{totalOrders}</span>
            </span>
            {cancelledRevenue > 0 && (
              <span>
                <span className="text-red-400/90">
                  {cancelledCount > 0
                    ? `${cancelledCount} cancelado${cancelledCount === 1 ? "" : "s"}`
                    : "Cancelados"}{" "}
                  ({brl(cancelledRevenue)})
                </span>{" "}
                — fora do faturamento
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
