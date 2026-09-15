import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Clock, CheckCircle2, XCircle, Package, Search, Filter, ChevronDown, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getRestaurantsByOwner } from "@/modules/supabase/restaurants";
import { getOrdersByRestaurant, updateOrderStatus } from "@/modules/supabase/orders";
import { supabase } from "@/modules/supabase/client";
import { brl } from "@/lib/utils";
import type { Order } from "@/lib/types";

export const Route = createFileRoute("/mobile/")({
  head: () => ({
    meta: [{ title: "Pedidos — Gestão Mobile" }],
  }),
  component: MobilePedidos,
});

function MobilePedidos() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [user, filter]);

  async function loadOrders() {
    if (!user) return;
    try {
      setLoading(true);
      const restaurants = await getRestaurantsByOwner(user.id);
      if (restaurants.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const allOrders: Order[] = [];
      for (const restaurant of restaurants) {
        const restaurantOrders = await getOrdersByRestaurant(restaurant.id);
        allOrders.push(...restaurantOrders);
      }

      let filtered = allOrders.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (filter === "pending") {
        filtered = filtered.filter(o => 
          ["received", "preparing", "ready", "out_for_delivery"].includes(o.status)
        );
      } else if (filter === "completed") {
        filtered = filtered.filter(o => 
          ["delivered", "cancelled"].includes(o.status)
        );
      }

      setOrders(filtered);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }

  async function updateStatus(orderId: string, newStatus: string) {
    try {
      await updateOrderStatus(orderId, newStatus);
      await loadOrders();
    } catch (error) {
      console.error("Error updating order:", error);
    }
  }

  function getStatusBadge(status: string) {
    const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
      received: { label: "Recebido", color: "text-amber-400", bg: "bg-amber-500/10" },
      preparing: { label: "Preparando", color: "text-blue-400", bg: "bg-blue-500/10" },
      ready: { label: "Pronto", color: "text-emerald-400", bg: "bg-emerald-500/10" },
      out_for_delivery: { label: "Saiu", color: "text-purple-400", bg: "bg-purple-500/10" },
      delivered: { label: "Entregue", color: "text-gray-400", bg: "bg-gray-500/10" },
      cancelled: { label: "Cancelado", color: "text-red-400", bg: "bg-red-500/10" },
    };

    const config = statusConfig[status] || { label: status, color: "text-gray-400", bg: "bg-gray-500/10" };
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${config.color} ${config.bg}`}>
        {config.label}
      </span>
    );
  }

  function getNextActions(status: string) {
    const flow: Record<string, string[]> = {
      received: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: ["out_for_delivery", "cancelled"],
      out_for_delivery: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
    };
    return flow[status] || [];
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="mx-auto size-8 animate-spin text-cyan-400" />
          <p className="mt-3 text-sm text-gray-400">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Pedidos</h1>
          <p className="text-xs text-gray-400">{orders.length} pedido{orders.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="grid size-10 place-items-center rounded-xl bg-white/5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(["all", "pending", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold uppercase transition-all ${
              filter === f
                ? "bg-cyan-500 text-black"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            {f === "all" ? "Todos" : f === "pending" ? "Pendentes" : "Concluídos"}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="size-12 text-gray-600" />
            <p className="mt-3 text-sm font-medium text-gray-400">Nenhum pedido encontrado</p>
            <p className="text-xs text-gray-600">Os pedidos aparecerão aqui quando chegarem</p>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3"
            >
              {/* Order Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">#{order.comanda}</h3>
                    {getStatusBadge(order.status)}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{order.customer_name}</p>
                  <p className="text-[10px] text-gray-500">
                    {new Date(order.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-cyan-400">{brl(Number(order.total))}</p>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-1.5 border-t border-white/5 pt-3">
                {order.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <span className="font-bold text-gray-400">{item.quantity}x</span>
                    <span className="flex-1 text-gray-300">{item.product_name}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              {getNextActions(order.status).length > 0 && (
                <div className="flex gap-2 border-t border-white/5 pt-3">
                  {getNextActions(order.status).map((action) => (
                    <button
                      key={action}
                      onClick={() => updateStatus(order.id, action)}
                      className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold uppercase transition-all ${
                        action === "cancelled"
                          ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          : "bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                      }`}
                    >
                      {action === "preparing" && "Preparar"}
                      {action === "ready" && "Pronto"}
                      {action === "out_for_delivery" && "Entregar"}
                      {action === "delivered" && "Concluir"}
                      {action === "cancelled" && "Cancelar"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default MobilePedidos;