import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Store,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Wallet,
  Award,
  Ban,
  Calendar,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinanceSummary } from "@/components/admin/FinanceSummary";
import { getRestaurantsByOwner, ensureRestaurantsForUser } from "@/modules/supabase/restaurants";
import { supabase } from "@/modules/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import type { OrderStatus, Restaurant } from "@/lib/types";
import { brl } from "@/lib/utils";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Cardápio Cidadela" }] }),
  component: FinanceiroPage,
});

type RangeKey = "7d" | "30d" | "90d" | "all";
type RestaurantFilter = string; // id or "all"

type OrderRow = {
  id: string;
  comanda: string;
  customer_name: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  restaurant_id: string;
};

function rangeStart(range: RangeKey): Date | null {
  if (range === "all") return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  d.setDate(d.getDate() - days);
  return d;
}

function FinanceiroPage() {
  const { user, loading: authLoading } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [activeId, setActiveId] = useState<RestaurantFilter>("all");
  const [range, setRange] = useState<RangeKey>("30d");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [prevOrders, setPrevOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setRestaurants([]);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        await ensureRestaurantsForUser(user!);
        if (cancelled) return;
        const data = await getRestaurantsByOwner(user!.id);
        if (cancelled) return;
        setRestaurants(data);
        if (data.length > 0) {
          retryRef.current = 0;
          setActiveId((prev) => (prev === "all" ? "all" : prev || data[0].id));
        } else if (retryRef.current < 3) {
          retryRef.current++;
          await new Promise((r) => setTimeout(r, retryRef.current * 400));
          if (cancelled) return;
          const retry = await getRestaurantsByOwner(user!.id);
          if (!cancelled) setRestaurants(retry);
        }
      } catch (e) {
        console.error("[financeiro] load", e);
        if (!cancelled) setError("Falha ao carregar dados financeiros.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  useEffect(() => {
    if (restaurants.length === 0) {
      setOrders([]);
      setPrevOrders([]);
      setOrdersLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchOrders() {
      setOrdersLoading(true);
      try {
        const ids = activeId === "all" ? restaurants.map((r) => r.id) : [activeId];
        const base = () =>
          supabase
            .from("orders")
            .select("id,comanda,customer_name,status,total,created_at,restaurant_id")
            .in("restaurant_id", ids)
            .order("created_at", { ascending: false })
            .limit(800);
        // Período atual
        const since = rangeStart(range);
        let q = base();
        if (since) q = q.gte("created_at", since.toISOString());
        const { data, error: err } = await q;
        // Período anterior (comparação real)
        const startPrev = since ? new Date(since) : null;
        if (startPrev) {
          const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
          startPrev.setDate(startPrev.getDate() - days);
        }
        let prevData: OrderRow[] = [];
        if (startPrev && since) {
          let pq = base();
          pq = pq.gte("created_at", startPrev.toISOString()).lt("created_at", since.toISOString());
          const { data: pd, error: pErr } = await pq;
          if (!pErr) prevData = (pd ?? []) as OrderRow[];
        }
        if (cancelled) return;
        if (err) {
          console.error("[financeiro] orders", err);
          toast.error("Falha ao carregar pedidos para financeiro.");
          setOrders([]);
          setPrevOrders([]);
        } else {
          setOrders((data ?? []) as OrderRow[]);
          setPrevOrders(prevData);
        }
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    }
    fetchOrders();
    return () => {
      cancelled = true;
    };
  }, [restaurants, activeId, range]);

  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const notCancelled = orders.filter((o) => o.status !== "cancelled");
    const cancelled = orders.filter((o) => o.status === "cancelled");
    const totalRevenue = notCancelled.reduce((s, o) => s + Number(o.total || 0), 0);
    const cancelledRevenue = cancelled.reduce((s, o) => s + Number(o.total || 0), 0);
    const averageTicket = notCancelled.length ? totalRevenue / notCancelled.length : 0;
    const statusCounts: Record<string, number> = {};
    for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
    return {
      totalOrders,
      totalRevenue,
      cancelledRevenue,
      averageTicket,
      deliveredCount: statusCounts["delivered"] ?? 0,
      cancelledCount: statusCounts["cancelled"] ?? 0,
      receivedCount: statusCounts["received"] ?? 0,
      preparingCount: statusCounts["preparing"] ?? 0,
      statusCounts,
    };
  }, [orders]);

  const perRestaurant = useMemo(() => {
    if (activeId !== "all") return [];
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const r = restaurants.find((x) => x.id === o.restaurant_id);
      const key = o.restaurant_id;
      const cur = map.get(key) ?? { name: r?.name ?? key.slice(0, 6), revenue: 0, count: 0 };
      cur.revenue += Number(o.total || 0);
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [orders, restaurants, activeId]);

  const daily = useMemo(() => {
    // bucket por dia no período
    const byDay = new Map<string, number>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const d = new Date(o.created_at);
      const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      byDay.set(key, (byDay.get(key) ?? 0) + Number(o.total || 0));
    }
    // manter ordem cronológica aproximada (orders já vem desc, então reverse)
    const entries = Array.from(byDay.entries()).reverse().slice(-14);
    // se vazio, retorna array vazio — gráfico mostra empty
    return entries.map(([day, revenue]) => ({ day, revenue }));
  }, [orders]);

  const previousPeriodComparison = useMemo(() => {
    if (range === "all") return null;
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const curRevenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + Number(o.total || 0), 0);
    const prevRevenue = prevOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + Number(o.total || 0), 0);
    return {
      days,
      curRevenue,
      prevRevenue,
      delta:
        prevRevenue > 0
          ? ((curRevenue - prevRevenue) / prevRevenue) * 100
          : curRevenue > 0
            ? 100
            : 0,
      hasPrev: prevOrders.length > 0,
    };
  }, [orders, prevOrders, range]);

  function handleExportCsv() {
    if (orders.length === 0) {
      toast.error("Nada para exportar.");
      return;
    }
    const header = ["data", "comanda", "cliente", "status", "total", "restaurante"].join(";");
    const rows = orders.map((o) => {
      const restName = restaurants.find((r) => r.id === o.restaurant_id)?.name ?? o.restaurant_id;
      const d = new Date(o.created_at).toLocaleString("pt-BR");
      return [
        d,
        o.comanda,
        `"${o.customer_name.replace(/"/g, '""')}"`,
        o.status,
        String(o.total).replace(".", ","),
        `"${restName.replace(/"/g, '""')}"`,
      ].join(";");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertCircle className="mx-auto size-8 text-red-400" />
        <p className="mt-3 text-sm text-red-300">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400"
        >
          <RefreshCw className="size-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-black tracking-tight text-white">Financeiro</h1>
        <p className="text-sm text-gray-500">
          Faturamento calculado pelos pedidos registrados — sem integração bancária, não representa
          saldo real.
        </p>
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <Store className="mx-auto size-10 text-gray-700" />
          <p className="mt-3 text-sm font-semibold text-white">Nenhum restaurante</p>
          <p className="mt-1 text-xs text-gray-500">Crie um restaurante para ver o financeiro.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Financeiro</h1>
          <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-gray-500">
            Faturamento calculado pelos pedidos registrados (não é saldo bancário). Cancelados não
            entram no faturamento. Ticket médio considera apenas pedidos não cancelados.
          </p>
        </div>
        <Button
          onClick={handleExportCsv}
          variant="outline"
          className="shrink-0 rounded-full border-white/10 bg-white/[0.04] text-xs font-semibold text-gray-300 hover:bg-white/[0.08] hover:text-white"
        >
          <Download className="size-3.5" /> Exportar CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400">
          <Store className="size-3.5" /> Restaurante
        </span>
        <Select value={activeId} onValueChange={setActiveId}>
          <SelectTrigger className="w-[200px] border-white/10 bg-white/[0.04] text-white">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#1a1a22] text-white">
            <SelectItem value="all">Todos ({restaurants.length})</SelectItem>
            {restaurants.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400">
          <Calendar className="size-3.5" /> Período
        </span>
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="w-[160px] border-white/10 bg-white/[0.04] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#1a1a22] text-white">
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto hidden items-center gap-1 text-[11px] text-gray-500 sm:inline-flex">
          {ordersLoading ? "Carregando…" : `${orders.length} pedidos no filtro`}
        </span>
      </div>

      {ordersLoading ? (
        <div className="flex h-[220px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="size-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        </div>
      ) : (
        <>
          <FinanceSummary
            metrics={{
              totalOrders: metrics.totalOrders,
              totalRevenue: metrics.totalRevenue,
              cancelledRevenue: metrics.cancelledRevenue,
              averageTicket: metrics.averageTicket,
              deliveredCount: metrics.deliveredCount,
              cancelledCount: metrics.cancelledCount,
              receivedCount: metrics.receivedCount,
              preparingCount: metrics.preparingCount,
            }}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                <TrendingUp className="size-3.5 text-cyan-400" /> Faturamento por dia
              </h3>
              <p className="mt-1 text-[11px] text-gray-500">
                Pedidos não cancelados • últimos dias no período selecionado
              </p>
              <div className="mt-4 h-[180px] w-full">
                {daily.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-gray-600">
                    Sem faturamento neste período.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={daily}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => brl(v)}
                        width={72}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0f0f14",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                          color: "#fff",
                          fontSize: 12,
                        }}
                        formatter={(value: number) => [brl(Number(value)), "Faturamento"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        dot={{ r: 3, stroke: "#06b6d4", fill: "#0a0a0f" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                <Wallet className="size-3.5 text-violet-400" /> Faturamento por restaurante
              </h3>
              <p className="mt-1 text-[11px] text-gray-500">
                {activeId === "all"
                  ? "Comparativo entre restaurantes (não cancelados)"
                  : 'Filtro único — selecione "Todos" para comparar'}
              </p>
              <div className="mt-4 h-[180px] w-full">
                {perRestaurant.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-gray-600">
                    {activeId !== "all"
                      ? 'Selecione "Todos" para ver o comparativo.'
                      : "Sem dados para comparar."}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={perRestaurant}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        angle={-12}
                        dy={10}
                        height={40}
                      />
                      <YAxis
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => brl(v)}
                        width={72}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0f0f14",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                          color: "#fff",
                          fontSize: 12,
                        }}
                        formatter={(value: number) => [brl(Number(value)), "Faturamento"]}
                      />
                      <Bar dataKey="revenue" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {perRestaurant.length > 0 && (
                <div className="mt-3 grid gap-1 text-[11px] text-gray-500">
                  {perRestaurant.map((r) => (
                    <div
                      key={r.name}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-1.5"
                    >
                      <span className="truncate font-medium text-gray-300">{r.name}</span>
                      <span className="font-bold text-white">
                        {brl(r.revenue)}{" "}
                        <span className="font-normal text-gray-500">• {r.count} pedidos</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {previousPeriodComparison && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                  <Award className="size-3.5 text-amber-400" /> Comparação de período
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">Período atual</span>
                  <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-white">
                    {brl(previousPeriodComparison.curRevenue)}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    vs. {range.replace("d", "")} dias antes
                  </span>
                  <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-gray-300">
                    {brl(previousPeriodComparison.prevRevenue)}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${previousPeriodComparison.delta >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}
                >
                  <TrendingUp
                    className={`size-3 ${previousPeriodComparison.delta < 0 ? "rotate-180" : ""}`}
                  />
                  {previousPeriodComparison.delta.toFixed(1)}%
                </span>
                <span className="text-[11px] text-gray-500">
                  {!previousPeriodComparison.hasPrev
                    ? "Sem pedidos do período anterior para comparar."
                    : previousPeriodComparison.prevRevenue === 0
                      ? "Período anterior sem faturamento."
                      : "Comparação real com a mesma janela (mesmos restaurantes, status não cancelados)."}
                </span>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-gray-600">
                Pedidos cancelados não entram no cálculo. Faturamento é calculado pelos pedidos
                registrados — não é saldo bancário.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-black/30">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Histórico financeiro
              </h3>
              <span className="text-[11px] text-gray-500">
                Mostrando até 80 • {orders.length} no filtro
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.02] text-[10px] uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Data</th>
                    <th className="px-4 py-2 font-semibold">Comanda</th>
                    <th className="px-4 py-2 font-semibold">Cliente</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                    <th className="px-4 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.slice(0, 80).map((o) => (
                    <tr key={o.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2 text-xs text-gray-400">
                        {new Date(o.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs font-bold text-white">
                        {o.comanda}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-300">{o.customer_name}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${o.status === "cancelled" ? "border-red-500/30 bg-red-500/10 text-red-300" : o.status === "delivered" ? "border-zinc-500/30 bg-zinc-500/10 text-zinc-300" : "border-cyan-500/20 bg-cyan-500/10 text-cyan-200"}`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-white">
                        {brl(Number(o.total))}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-600">
                        Nenhum pedido neste filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {orders.length > 80 && (
              <p className="px-4 py-2 text-center text-[11px] text-gray-600">
                Mostrando 80 de {orders.length}. Use Exportar CSV para ver tudo.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-200/90">
            <span className="font-bold">Aviso:</span> Este financeiro é calculado a partir dos
            pedidos registrados no sistema. Não é extrato bancário nem considera taxas de
            gateway/PIX. Pedido cancelado nunca entra no faturamento.
          </div>
        </>
      )}
    </div>
  );
}
