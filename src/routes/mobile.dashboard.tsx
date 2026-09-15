import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { TrendingUp, DollarSign, Package, Clock, RefreshCw, Calendar } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getRestaurantsByOwner } from "@/modules/supabase/restaurants";
import { getOrdersByRestaurant } from "@/modules/supabase/orders";
import { brl } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export const Route = createFileRoute("/mobile/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Gestão Mobile" }],
  }),
  component: MobileDashboard,
});

const COLORS = ["#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

function MobileDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    statusDistribution: [] as Array<{ name: string; value: number; color: string }>,
    dailyRevenue: [] as Array<{ date: string; value: number }>,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, [user]);

  async function loadStats() {
    if (!user) return;
    try {
      setLoading(true);
      const restaurants = await getRestaurantsByOwner(user.id);
      if (restaurants.length === 0) {
        setStats({
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          statusDistribution: [],
          dailyRevenue: [],
        });
        setLoading(false);
        return;
      }

      let allOrders: any[] = [];
      for (const restaurant of restaurants) {
        const orders = await getOrdersByRestaurant(restaurant.id);
        allOrders.push(...orders);
      }

      const totalOrders = allOrders.length;
      const totalRevenue = allOrders.reduce((sum, order) => sum + Number(order.total), 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Status distribution
      const statusCount = allOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statusDistribution = Object.entries(statusCount).map(([name, value], idx) => ({
        name: getStatusLabel(name),
        value,
        color: COLORS[idx % COLORS.length],
      }));

      // Daily revenue (last 7 days)
      const dailyRevenue = getLast7DaysRevenue(allOrders);

      setStats({
        totalOrders,
        totalRevenue,
        averageOrderValue,
        statusDistribution,
        dailyRevenue,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      received: "Recebidos",
      preparing: "Preparando",
      ready: "Prontos",
      out_for_delivery: "Entregando",
      delivered: "Entregues",
      cancelled: "Cancelados",
    };
    return labels[status] || status;
  }

  function getLast7DaysRevenue(orders: any[]) {
    const days: Record<string, number> = {};
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      days[dateStr] = 0;
    }

    orders.forEach(order => {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      if (days.hasOwnProperty(orderDate)) {
        days[orderDate] += Number(order.total);
      }
    });

    return Object.entries(days).map(([date, value]) => ({
      date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      value,
    }));
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="mx-auto size-8 animate-spin text-cyan-400" />
          <p className="mt-3 text-sm text-gray-400">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Dashboard</h1>
          <p className="text-xs text-gray-400">Visão geral do negócio</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="grid size-10 place-items-center rounded-xl bg-white/5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/[0.08] to-cyan-600/[0.04] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="size-4 text-cyan-400" />
            <span className="text-[10px] font-bold uppercase text-gray-500">Pedidos</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
          <p className="text-[10px] text-gray-400 mt-1">Total de pedidos</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.08] to-emerald-600/[0.04] p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="size-4 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase text-gray-500">Receita</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{brl(stats.totalRevenue)}</p>
          <p className="text-[10px] text-gray-400 mt-1">Faturamento total</p>
        </div>

        <div className="col-span-2 rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/[0.08] to-violet-600/[0.04] p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="size-4 text-violet-400" />
            <span className="text-[10px] font-bold uppercase text-gray-500">Ticket Médio</span>
          </div>
          <p className="text-2xl font-bold text-violet-400">{brl(stats.averageOrderValue)}</p>
          <p className="text-[10px] text-gray-400 mt-1">Valor médio por pedido</p>
        </div>
      </div>

      {/* Status Distribution Chart */}
      {stats.statusDistribution.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="size-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Status dos Pedidos</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {stats.statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#14141d",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value, entry: any) => (
                    <span style={{ color: "#9ca3af", fontSize: "11px" }}>
                      {value}: {entry.payload.value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Daily Revenue */}
      {stats.dailyRevenue.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="size-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Receita (7 dias)</h3>
          </div>
          <div className="space-y-2">
            {stats.dailyRevenue.map((day, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{day.date}</span>
                <span className="text-sm font-bold text-cyan-400">{brl(day.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileDashboard;