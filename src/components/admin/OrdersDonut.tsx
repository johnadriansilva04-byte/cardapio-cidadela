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
  totalRevenue: number; // computed elsewhere; passed for legend
  totalOrders: number;
};

export function OrdersDonut({ counts, totalOrders }: Props) {
  const data = (Object.keys(counts) as OrderStatus[])
    .map((s) => ({ name: ORDER_STATUS_LABELS[s], key: s, value: counts[s] ?? 0, color: STATUS_COLOR[s] }))
    .filter((d) => d.value > 0);

  if (totalOrders === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] px-4 text-center">
        <p className="text-sm text-gray-500">Sem pedidos ainda — o gráfico aparece assim que cair o primeiro.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="h-[180px] w-full sm:h-[200px] sm:w-[220px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="rgba(255,255,255,0.08)">
                {data.map((e) => (
                  <Cell key={e.key} fill={e.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#0f0f14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 12 }}
                formatter={(value: unknown, _name: unknown, props: unknown) => {
                  const v = Number(value ?? 0);
                  const key = (props as { payload?: { key?: OrderStatus } } | undefined)?.payload?.key;
                  const pct = totalOrders ? ((v / totalOrders) * 100).toFixed(1) : "0.0";
                  const label = key ? ORDER_STATUS_LABELS[key] : String(_name ?? "");
                  return [`${v} • ${pct}%`, label] as unknown as string;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Pedidos por status</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(counts) as OrderStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-2.5 py-2">
                <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                <span className="flex-1 truncate text-xs font-medium text-gray-300">{ORDER_STATUS_LABELS[s]}</span>
                <span className="text-xs font-bold text-white">{counts[s] ?? 0}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500">
            Total <span className="font-bold text-white">{totalOrders}</span> pedidos • passe o mouse no gráfico para ver percentual.
          </p>
        </div>
      </div>
    </div>
  );
}
