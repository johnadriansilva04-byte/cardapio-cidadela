import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getOrderTrackingPublic, getOrderHistory, subscribeToOrders } from "@/modules/supabase/orders";
import { supabase } from "@/modules/supabase/client";
import { brl, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/types";
import type { Order, OrderStatus } from "@/lib/types";

export const Route = createFileRoute("/pedido/$orderId")({
  head: () => ({
    meta: [{ title: "Acompanhar Pedido" }],
  }),
  component: OrderTrackingPage,
});

function OrderTrackingPage() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<{ status: OrderStatus; note: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const o = await getOrderTrackingPublic(orderId);
      if (!alive) return;
      if (!o) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setOrder(o);
      const h = await getOrderHistory(orderId);
      if (!alive) return;
      setHistory(h);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [orderId]);

  // Subscribe to status updates
  useEffect(() => {
    if (!order) return;
    const sub = subscribeToOrders(order.restaurant_id, (updated) => {
      if (updated.id === orderId) {
        setOrder((prev) => (prev ? { ...prev, status: updated.status } : prev));
      }
    });
    return () => {
      if (sub) {
        supabase.removeChannel(sub);
      }
    };
  }, [order, orderId]);

  const STATUS_STEPS: OrderStatus[] = ["received", "preparing", "ready", "delivered"];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-400">Carregando pedido...</p>
        </div>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center px-6">
          <p className="text-5xl mb-4">🔍</p>
          <h1 className="text-xl font-bold text-white">Pedido não encontrado</h1>
          <p className="mt-2 text-sm text-gray-400">
            Verifique o link e tente novamente.
          </p>
        </div>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.indexOf(order.status);

  return (
    <div className="min-h-screen bg-black px-4 py-6">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold text-white">Acompanhar Pedido</h1>
          <p className="mt-1 text-sm text-gray-400">
            Comanda {order.comanda}
          </p>
        </div>

        {/* Status badge */}
        <div className="mb-6 text-center">
          <span
            className={`inline-block rounded-full border px-4 py-2 text-sm font-bold ${ORDER_STATUS_COLORS[order.status]}`}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>

        {/* Progress steps */}
        <div className="mb-6">
          <div className="relative">
            {/* Progress line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-800" />
            <div
              className="absolute left-6 top-0 w-0.5 bg-cyan-500 transition-all duration-500"
              style={{
                height: `${currentStepIndex >= 0 ? ((currentStepIndex + 1) / STATUS_STEPS.length) * 100 : 0}%`,
              }}
            />

            {STATUS_STEPS.map((step, idx) => {
              const isCompleted = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step} className="relative flex items-center gap-4 py-3">
                  <div
                    className={`relative z-10 size-12 shrink-0 rounded-full border-2 ${
                      isCompleted
                        ? "border-cyan-500 bg-cyan-500/20"
                        : "border-gray-700 bg-black"
                    } flex items-center justify-center`}
                  >
                    {isCompleted ? (
                      <span className="text-lg">
                        {idx === 0 && "📋"}
                        {idx === 1 && "👨‍🍳"}
                        {idx === 2 && "✅"}
                        {idx === 3 && "🎉"}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">{idx + 1}</span>
                    )}
                  </div>
                  <div>
                    <p
                      className={`text-sm font-bold ${
                        isCompleted ? "text-white" : "text-gray-600"
                      }`}
                    >
                      {ORDER_STATUS_LABELS[step]}
                    </p>
                    {isCurrent && (
                      <p className="text-[10px] text-cyan-400">
                        Status atual
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order details */}
        <div className="rounded-xl border border-cyan-500/20 bg-black/40 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase text-gray-500">
            Detalhes do pedido
          </h3>

          {order.order_items && order.order_items.length > 0 && (
            <div className="space-y-2">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-300">
                    {item.quantity}x {item.product_name}
                  </span>
                  <span className="font-bold text-white">{brl(item.total)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 border-t border-gray-800 pt-3">
            <div className="flex justify-between text-base font-bold text-white">
              <span>Total</span>
              <span>{brl(order.total)}</span>
            </div>
          </div>

          {order.observations && (
            <div className="mt-3 rounded-lg bg-black/40 p-2">
              <p className="text-[10px] text-gray-500">Observações:</p>
              <p className="text-xs text-gray-300">{order.observations}</p>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <p className="mt-4 text-center text-[10px] text-gray-600">
          Pedido realizado em {formatDate(order.created_at)}
        </p>
      </div>
    </div>
  );
}
