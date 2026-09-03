import { useEffect, useState } from "react";
import {
  RefreshCw,
  Printer,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import type { Restaurant, Order, OrderStatus } from "@/lib/types";
import { brl, buildThermalTicket, printTicket, buildWhatsAppMessage, sendToWhatsApp } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/types";
import {
  getOrdersByRestaurant,
  updateOrderStatus,
  subscribeToOrders,
} from "@/modules/supabase/orders";
import { supabase } from "@/modules/supabase/client";

export function OrderManager({ restaurant }: { restaurant: Restaurant }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  async function loadOrders() {
    setLoading(true);
    const data = await getOrdersByRestaurant(restaurant.id);
    setOrders(data);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  // Real-time subscription
  useEffect(() => {
    const sub = subscribeToOrders(restaurant.id, (newOrder) => {
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === newOrder.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = newOrder;
          return updated;
        }
        return [newOrder, ...prev];
      });
    });

    return () => {
      if (sub) supabase.removeChannel(sub);
    };
  }, [restaurant.id]);

  async function changeStatus(orderId: string, status: OrderStatus) {
    const ok = await updateOrderStatus(orderId, status);
    if (ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
      );
    }
  }

  function printOrder(order: Order) {
    const ticket = buildThermalTicket(
      {
        comanda: order.comanda,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        delivery_address: order.delivery_address,
        delivery_type: order.delivery_type,
        observations: order.observations,
        total: order.total,
        payment_method: order.payment_method,
        order_items: order.order_items?.map((i) => ({
          product_name: i.product_name,
          quantity: i.quantity,
          total: i.total,
        })),
        created_at: order.created_at,
      },
      restaurant.name,
    );
    printTicket(ticket);
  }

  function sendWhatsApp(order: Order) {
    if (!restaurant.whatsapp) {
      alert("WhatsApp do restaurante não configurado");
      return;
    }
    const msg = buildWhatsAppMessage(
      {
        comanda: order.comanda,
        customer_name: order.customer_name,
        total: order.total,
        order_items: order.order_items?.map((i) => ({
          product_name: i.product_name,
          quantity: i.quantity,
          total: i.total,
        })),
        observations: order.observations,
        payment_method: order.payment_method,
        delivery_type: order.delivery_type,
        delivery_address: order.delivery_address,
      },
      restaurant.name,
    );
    sendToWhatsApp(restaurant.whatsapp, msg);
  }

  const filteredOrders =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const statusCounts = orders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
    received: "preparing",
    preparing: "ready",
    ready: "delivered",
    delivered: null,
    cancelled: null,
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        {(["received", "preparing", "ready", "delivered"] as const).map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? "all" : s)}
              className={`rounded-lg border p-2 text-center ${
                filter === s
                  ? "border-cyan-500 bg-cyan-500/20"
                  : "border-gray-700 bg-black/40"
              }`}
            >
              <p className="text-lg font-bold text-white">
                {statusCounts[s] ?? 0}
              </p>
              <p className="text-[8px] uppercase text-gray-400">
                {ORDER_STATUS_LABELS[s]}
              </p>
            </button>
          ),
        )}
      </div>

      {/* Refresh */}
      <div className="flex items-center justify-between">
        <button
          onClick={loadOrders}
          className="flex items-center gap-1 text-[10px] font-semibold text-cyan-400"
        >
          <RefreshCw
            className={`size-3 ${loading ? "animate-spin" : ""}`}
          />{" "}
          Atualizar
        </button>
        <span className="text-[10px] text-gray-500">
          {filteredOrders.length} pedidos
        </span>
      </div>

      {/* Orders list */}
      {filteredOrders.length === 0 && (
        <p className="py-8 text-center text-xs text-gray-500">
          Nenhum pedido{filter !== "all" ? ` com status "${ORDER_STATUS_LABELS[filter]}"` : ""}
        </p>
      )}

      {filteredOrders.map((order) => {
        const next = NEXT_STATUS[order.status];
        return (
          <div
            key={order.id}
            className="rounded-xl border border-cyan-500/20 bg-black/40 p-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-white">
                  {order.comanda}
                </span>
                <span className="ml-2 text-[10px] text-gray-500">
                  {new Date(order.created_at).toLocaleString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${ORDER_STATUS_COLORS[order.status]}`}
              >
                {ORDER_STATUS_LABELS[order.status]}
              </span>
            </div>

            {/* Customer */}
            <p className="mt-2 text-xs text-gray-400">
              {order.customer_name} • {order.customer_phone}
            </p>

            {/* Items */}
            {order.order_items && order.order_items.length > 0 && (
              <div className="mt-2 space-y-1">
                {order.order_items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between text-xs text-gray-300"
                  >
                    <span>
                      {item.quantity}x {item.product_name}
                    </span>
                    <span>{brl(item.total)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            <div className="mt-2 flex justify-between border-t border-gray-800 pt-2 text-sm font-bold text-white">
              <span>Total</span>
              <span>{brl(order.total)}</span>
            </div>

            {/* Observations */}
            {order.observations && (
              <p className="mt-2 text-[10px] text-gray-500 italic">
                📝 {order.observations}
              </p>
            )}

            {/* Delivery info */}
            {order.delivery_type === "entrega" &&
              order.delivery_address && (
                <p className="mt-1 text-[10px] text-gray-500">
                  📍 {order.delivery_address}
                </p>
              )}

            {/* Actions */}
            <div className="mt-3 flex flex-wrap gap-2">
              {next && (
                <button
                  onClick={() => changeStatus(order.id, next)}
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-cyan-500"
                >
                  → {ORDER_STATUS_LABELS[next]}
                </button>
              )}

              {order.status !== "cancelled" && order.status !== "delivered" && (
                <button
                  onClick={() => changeStatus(order.id, "cancelled")}
                  className="rounded-lg border border-red-500/40 px-3 py-1.5 text-[10px] text-red-400 hover:bg-red-500/10"
                >
                  Cancelar
                </button>
              )}

              <button
                onClick={() => printOrder(order)}
                className="flex items-center gap-1 rounded-lg border border-cyan-500/40 px-2 py-1.5 text-[10px] text-cyan-300"
              >
                <Printer className="size-3" /> Imprimir
              </button>

              {restaurant.whatsapp && (
                <button
                  onClick={() => sendWhatsApp(order)}
                  className="flex items-center gap-1 rounded-lg border border-green-500/40 px-2 py-1.5 text-[10px] text-green-400"
                >
                  📱 WhatsApp
                </button>
              )}

              <a
                href={`/pedido/${order.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-lg border border-gray-600/40 px-2 py-1.5 text-[10px] text-gray-400"
              >
                <ExternalLink className="size-3" /> Rastrear
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
