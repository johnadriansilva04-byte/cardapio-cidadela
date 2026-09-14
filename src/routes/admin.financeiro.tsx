import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Store,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Wallet,
  Download,
  Calendar,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Cardápio Cidadela" }] }),
  component: FinanceiroPage,
});

type RangeKey = "7d" | "30d" | "90d" | "all";
type ChartType = "bar" | "line" | "pie";
type RestaurantFilter = string;

type OrderRow = {
  id: string;
  comanda: string;
  customer_name: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  restaurant_id: string;
};

const RESTAURANT_COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#22c55e", "#ef4444", "#ec4899", "#14b8a6", "#f97316"];

const tooltipStyle = {
  background: "#0f0f14",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#fff",
  fontSize: 12,
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

  // chart toggle states
  const [dailyChartType, setDailyChartType] = useState<ChartType>("bar");
  const [restChartType, setRestChartType] = useState<ChartType>("pie");

  // collapsible history
  const [historyOpen, setHistoryOpen] = useState(false);

  const retryRef = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); setRestaurants([]); return; }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true); setError(null);
        await ensureRestaurantsForUser(user!);
        if (cancelled) return;
        const data = await getRestaurantsByOwner(user!.id);
        if (cancelled) return;
        setRestaurants(data);
        if (data.length > 0) { retryRef.current = 0; setActiveId((prev) => (prev === "all" ? "all" : prev || data[0].id)); }
        else if (retryRef.current < 3) {
          retryRef.current++;
          await new Promise((r) => setTimeout(r, retryRef.current * 400));
          if (cancelled) return;
          const retry = await getRestaurantsByOwner(user!.id);
          if (!cancelled) setRestaurants(retry);
        }
      } catch (e) {
        console.error("[financeiro] load", e);
        if (!cancelled) setError("Falha ao carregar dados financeiros.");
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  useEffect(() => {
    if (restaurants.length === 0) { setOrders([]); setPrevOrders([]); setOrdersLoading(false); return; }
    let cancelled = false;
    async function fetchOrders() {
      setOrdersLoading(true);
      try {
        const ids = activeId === "all" ? restaurants.map((r) => r.id) : [activeId];
        const base = () =>
          supabase.from("orders").select("id,comanda,customer_name,status,total,created_at,restaurant_id").in("restaurant_id", ids).order("created_at", { ascending: false }).limit(800);
        const since = rangeStart(range);
        let q = base();
        if (since) q = q.gte("created_at", since.toISOString());
        const { data, error: err } = await q;
        const startPrev = since ? new Date(since) : null;
        if (startPrev) { const days = range === "7d" ? 7 : range === "30d" ? 30 : 90; startPrev.setDate(startPrev.getDate() - days); }
        let prevData: OrderRow[] = [];
        if (startPrev && since) {
          let pq = base();
          pq = pq.gte("created_at", startPrev.toISOString()).lt("created_at", since.toISOString());
          const { data: pd, error: pErr } = await pq;
          if (!pErr) prevData = (pd ?? []) as OrderRow[];
        }
        if (cancelled) return;
        if (err) { console.error("[financeiro] orders", err); toast.error("Falha ao carregar pedidos."); setOrders([]); setPrevOrders([]); }
        else { setOrders((data ?? []) as OrderRow[]); setPrevOrders(prevData); }
      } finally { if (!cancelled) setOrdersLoading(false); }
    }
    fetchOrders();
    return () => { cancelled = true; };
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
    return { totalOrders, totalRevenue, cancelledRevenue, averageTicket, deliveredCount: statusCounts["delivered"] ?? 0, cancelledCount: statusCounts["cancelled"] ?? 0, receivedCount: statusCounts["received"] ?? 0, preparingCount: statusCounts["preparing"] ?? 0, statusCounts };
  }, [orders]);

  const perRestaurant = useMemo(() => {
    if (activeId !== "all") return [];
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const r = restaurants.find((x) => x.id === o.restaurant_id);
      const cur = map.get(o.restaurant_id) ?? { name: r?.name ?? o.restaurant_id.slice(0, 6), revenue: 0, count: 0 };
      cur.revenue += Number(o.total || 0);
      cur.count += 1;
      map.set(o.restaurant_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [orders, restaurants, activeId]);

  const daily = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const d = new Date(o.created_at);
      const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      byDay.set(key, (byDay.get(key) ?? 0) + Number(o.total || 0));
    }
    return Array.from(byDay.entries()).reverse().slice(-14).map(([day, revenue]) => ({ day, revenue }));
  }, [orders]);

  const previousPeriodComparison = useMemo(() => {
    if (range === "all") return null;
    const curRevenue = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total || 0), 0);
    const prevRevenue = prevOrders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total || 0), 0);
    return {
      curRevenue, prevRevenue,
      delta: prevRevenue > 0 ? ((curRevenue - prevRevenue) / prevRevenue) * 100 : curRevenue > 0 ? 100 : 0,
      hasPrev: prevOrders.length > 0,
    };
  }, [orders, prevOrders, range]);

  const totalRevenueAll = perRestaurant.reduce((s, r) => s + r.revenue, 0);

  function handleExportCsv() {
    if (orders.length === 0) { toast.error("Nada para exportar."); return; }
    const header = ["data", "comanda", "cliente", "status", "total", "restaurante"].join(";");
    const rows = orders.map((o) => {
      const restName = restaurants.find((r) => r.id === o.restaurant_id)?.name ?? o.restaurant_id;
      const d = new Date(o.created_at).toLocaleString("pt-BR");
      return [d, o.comanda, `"${o.customer_name.replace(/"/g, '""')}"`, o.status, String(o.total).replace(".", ","), `"${restName.replace(/"/g, '""')}"`].join(";");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-${range}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  }

  if (authLoading || loading) {
    return <div className="flex items-center justify-center py-20"><div className="size-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" /></div>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertCircle className="mx-auto size-8 text-red-400" />
        <p className="mt-3 text-sm text-red-300">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400"><RefreshCw className="size-4" /> Tentar novamente</button>
      </div>
    );
  }
  if (restaurants.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-black tracking-tight text-white">Financeiro</h1>
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <Store className="mx-auto size-10 text-gray-700" />
          <p className="mt-3 text-sm font-semibold text-white">Nenhum restaurante</p>
          <p className="mt-1 text-xs text-gray-500">Crie um restaurante para ver o financeiro.</p>
        </div>
      </div>
    );
  }

  const chartToggleBtn = (active: ChartType, current: ChartType, onClick: () => void, Icon: typeof BarChart3, label: string) => (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors ${active === current ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
    >
      <Icon className="size-3" /> {label}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Financeiro</h1>
          <p className="mt-0.5 text-xs text-gray-500">Resumo dos pedidos registrados — sem integração bancária.</p>
        </div>
        <Button onClick={handleExportCsv} variant="outline" className="shrink-0 rounded-full border-white/10 bg-white/[0.04] text-xs font-semibold text-gray-300 hover:bg-white/[0.08] hover:text-white">
          <Download className="size-3.5" /> Exportar CSV
        </Button>
      </div>

      {/* ─── FILTERS ─── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <Store className="size-3.5 text-gray-500" />
        <Select value={activeId} onValueChange={setActiveId}>
          <SelectTrigger className="h-8 w-[180px] border-white/10 bg-white/[0.04] text-xs text-white"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent className="border-white/10 bg-[#1a1a22] text-white">
            <SelectItem value="all">Todos ({restaurants.length})</SelectItem>
            {restaurants.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Calendar className="size-3.5 text-gray-500" />
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="h-8 w-[140px] border-white/10 bg-white/[0.04] text-xs text-white"><SelectValue /></SelectTrigger>
          <SelectContent className="border-white/10 bg-[#1a1a22] text-white">
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-[11px] text-gray-500">{ordersLoading ? "…" : `${orders.length} pedidos`}</span>
      </div>

      {ordersLoading ? (
        <div className="flex h-[200px] items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="size-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* ─── CARDS ─── */}
          <FinanceSummary metrics={metrics} />

          {/* ─── CHARTS ROW ─── */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Daily revenue */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-3.5 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Faturamento por dia</h3>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex size-4 items-center justify-center rounded-full bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300"><HelpCircle className="size-3" /></button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px] border-white/10 bg-[#1a1a22] text-xs text-gray-300">
                        Soma diária dos pedidos não cancelados no período selecionado.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.03] p-0.5">
                  {chartToggleBtn("bar", dailyChartType, () => setDailyChartType("bar"), BarChart3, "Barras")}
                  {chartToggleBtn("line", dailyChartType, () => setDailyChartType("line"), Activity, "Linha")}
                  {chartToggleBtn("pie", dailyChartType, () => setDailyChartType("pie"), PieChartIcon, "Pizza")}
                </div>
              </div>
              <div className="mt-3 h-[200px] w-full">
                {daily.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-gray-600">Sem faturamento neste período.</div>
                ) : dailyChartType === "pie" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={daily} dataKey="revenue" nameKey="day" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="rgba(255,255,255,0.08)" startAngle={90} endAngle={-270}>
                        {daily.map((_, i) => <Cell key={i} fill={RESTAURANT_COLORS[i % RESTAURANT_COLORS.length]} />)}
                      </Pie>
                      <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => [brl(Number(v)), "Faturamento"]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : dailyChartType === "bar" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={daily}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => brl(v)} width={64} />
                      <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => [brl(Number(v)), "Faturamento"]} />
                      <Bar dataKey="revenue" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={daily}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => brl(v)} width={64} />
                      <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => [brl(Number(v)), "Faturamento"]} />
                      <Line type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3, stroke: "#06b6d4", fill: "#0a0a0f" }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Per-restaurant revenue */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="size-3.5 text-violet-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Por restaurante</h3>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex size-4 items-center justify-center rounded-full bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300"><HelpCircle className="size-3" /></button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px] border-white/10 bg-[#1a1a22] text-xs text-gray-300">
                        Participação de cada restaurante no faturamento total. Selecione "Todos" para comparar.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.03] p-0.5">
                  {chartToggleBtn("pie", restChartType, () => setRestChartType("pie"), PieChartIcon, "Pizza")}
                  {chartToggleBtn("bar", restChartType, () => setRestChartType("bar"), BarChart3, "Barras")}
                </div>
              </div>
              <div className="mt-3 h-[200px] w-full">
                {perRestaurant.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-gray-600">
                    {activeId !== "all" ? 'Selecione "Todos" para comparar.' : "Sem dados."}
                  </div>
                ) : restChartType === "pie" ? (
                  <div className="flex h-full items-center gap-4">
                    <div className="relative h-[180px] w-[180px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={perRestaurant} dataKey="revenue" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} stroke="rgba(255,255,255,0.08)" startAngle={90} endAngle={-270}>
                            {perRestaurant.map((_, i) => <Cell key={i} fill={RESTAURANT_COLORS[i % RESTAURANT_COLORS.length]} />)}
                          </Pie>
                          <RTooltip contentStyle={tooltipStyle} formatter={(v: number, _n: string, p: { payload?: { name?: string } }) => [brl(Number(v)), p?.payload?.name ?? ""]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-[9px] font-semibold uppercase text-gray-500">Total</p>
                        <p className="text-sm font-black text-white">{brl(totalRevenueAll)}</p>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {perRestaurant.map((r, i) => (
                        <div key={r.name} className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-2.5 py-1.5">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: RESTAURANT_COLORS[i % RESTAURANT_COLORS.length] }} />
                          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-300">{r.name}</span>
                          <span className="shrink-0 text-[11px] font-bold text-white">{brl(r.revenue)}</span>
                          <span className="shrink-0 text-[10px] text-gray-500">{totalRevenueAll ? ((r.revenue / totalRevenueAll) * 100).toFixed(0) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={perRestaurant}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-12} dy={10} height={40} />
                      <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => brl(v)} width={64} />
                      <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => [brl(Number(v)), "Faturamento"]} />
                      <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                        {perRestaurant.map((_, i) => <Cell key={i} fill={RESTAURANT_COLORS[i % RESTAURANT_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* ─── COMPARISON + HISTORY (2 cols) ─── */}
          {previousPeriodComparison && (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Comparison */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="size-3.5 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Comparação de período</h3>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex size-4 items-center justify-center rounded-full bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300"><HelpCircle className="size-3" /></button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] border-white/10 bg-[#1a1a22] text-xs text-gray-300">
                        Compara o faturamento atual com a mesma janela de tempo imediatamente anterior. Pedidos cancelados não entram no cálculo.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase text-gray-500">Atual</p>
                      <p className="mt-0.5 text-base font-black text-white">{brl(previousPeriodComparison.curRevenue)}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase text-gray-500">Anterior</p>
                      <p className="mt-0.5 text-base font-black text-gray-400">{brl(previousPeriodComparison.prevRevenue)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${previousPeriodComparison.delta >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                      <TrendingUp className={`size-3 ${previousPeriodComparison.delta < 0 ? "rotate-180" : ""}`} />
                      {previousPeriodComparison.delta.toFixed(1)}%
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {!previousPeriodComparison.hasPrev ? "Sem dados do período anterior" : previousPeriodComparison.prevRevenue === 0 ? "Sem faturamento no anterior" : "Variação real"}
                    </span>
                  </div>
                </div>
              </div>

              {/* History (collapsible) */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => setHistoryOpen(!historyOpen)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="size-3.5 text-gray-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Histórico financeiro</h3>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-gray-300">{orders.length}</span>
                  </div>
                  {historyOpen ? <ChevronUp className="size-4 text-gray-500" /> : <ChevronDown className="size-4 text-gray-500" />}
                </button>
                {historyOpen && (
                  <div className="overflow-x-auto border-t border-white/[0.06]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/[0.02] text-[10px] uppercase tracking-widest text-gray-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Data</th>
                          <th className="px-3 py-2 font-semibold">Comanda</th>
                          <th className="px-3 py-2 font-semibold">Cliente</th>
                          <th className="px-3 py-2 font-semibold">Status</th>
                          <th className="px-3 py-2 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {orders.slice(0, 80).map((o) => (
                          <tr key={o.id} className="hover:bg-white/[0.02]">
                            <td className="px-3 py-1.5 text-[11px] text-gray-400">
                              {new Date(o.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="px-3 py-1.5 font-mono text-[11px] font-bold text-white">{o.comanda}</td>
                            <td className="px-3 py-1.5 text-[11px] text-gray-300">{o.customer_name}</td>
                            <td className="px-3 py-1.5">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${o.status === "cancelled" ? "border-red-500/30 bg-red-500/10 text-red-300" : o.status === "delivered" ? "border-zinc-500/30 bg-zinc-500/10 text-zinc-300" : "border-cyan-500/20 bg-cyan-500/10 text-cyan-200"}`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right text-[11px] font-bold text-white">{brl(Number(o.total))}</td>
                          </tr>
                        ))}
                        {orders.length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-600">Nenhum pedido neste filtro.</td></tr>
                        )}
                      </tbody>
                    </table>
                    {orders.length > 80 && <p className="px-3 py-2 text-center text-[11px] text-gray-600">Mostrando 80 de {orders.length}. Use Exportar CSV.</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
