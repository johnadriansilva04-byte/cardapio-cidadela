import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getOrderTrackingPublic,
  getOrderHistory,
  subscribeToOrders,
} from "@/modules/supabase/orders";
import { supabase } from "@/modules/supabase/client";
import { brl, formatDate, paymentMethodLabel, soberaniaPoints } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/types";
import type { Order, OrderStatus } from "@/lib/types";

export const Route = createFileRoute("/pedido/$orderId")({
  head: () => ({
    meta: [{ title: "Acompanhar Pedido" }],
  }),
  component: OrderTrackingPage,
});

// Um ícone por etapa; "A caminho" usa o mesmo emoji do entregador na retirada
// também, então não depende do índice (que muda conforme o tipo de pedido).
const STEP_ICONS: Record<OrderStatus, string> = {
  received: "📋",
  preparing: "👨‍🍳",
  ready: "✅",
  out_for_delivery: "🛵",
  delivered: "🎉",
  cancelled: "❌",
};

function OrderTrackingPage() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<
    { status: OrderStatus; note: string; created_at: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const o = await getOrderTrackingPublic(orderId);
      if (!alive) return;
      if (!o) {
        // Fallback local: pedido criado neste dispositivo nesta sessão.
        // (Antes de aplicar supabase/schema.sql, a RPC get_order_tracking
        // não existe no banco e o tracking remoto não pode ler dados.)
        try {
          const raw = localStorage.getItem("last_order");
          const local = raw ? JSON.parse(raw) : null;
          if (local && local.id === orderId) {
            const fee = Number(local.delivery_fee ?? 0) || 0;
            const subtotal =
              typeof local.subtotal === "number" ? local.subtotal : Number(local.total ?? 0) - fee;
            setOrder({
              id: local.id,
              restaurant_id: "",
              customer_id: null,
              idempotency_key: null,
              comanda: local.comanda,
              customer_name: local.customer_name ?? "Cliente",
              customer_phone: local.customer_phone ?? "",
              customer_email: "",
              delivery_address: local.delivery_address ?? "",
              customer_complement: "",
              customer_neighborhood: "",
              customer_city: "",
              delivery_type: local.delivery_type ?? "retirada",
              observations: local.observations ?? "",
              subtotal,
              delivery_fee: fee,
              total: Number(local.total ?? 0),
              payment_method: local.payment_method ?? "pix",
              payment_status: "awaiting_confirmation",
              status: "received",
              cidadela_unlocked: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              order_items: (local.items ?? []).map(
                (it: { product_name: string; quantity: number; total: number }, i: number) => ({
                  id: `local-${i}`,
                  product_id: "",
                  product_name: it.product_name,
                  quantity: it.quantity,
                  unit_price: it.quantity > 0 ? it.total / it.quantity : 0,
                  total: it.total,
                  notes: "",
                }),
              ),
            });
            setLoading(false);
            return;
          }
        } catch {
          /* storage indisponível */
        }
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
    return () => {
      alive = false;
    };
  }, [orderId]);

  // Subscribe to status updates.
  // Depende do id da loja (string estável), não do objeto `order`: a cada
  // status novo o objeto muda de identidade e o canal era derrubado e
  // recriado, perdendo eventos durante a reconexão.
  const restaurantId = order?.restaurant_id ?? "";
  useEffect(() => {
    if (!restaurantId) return;
    const sub = subscribeToOrders(restaurantId, (_eventType, updated) => {
      if (updated.id === orderId) {
        setOrder((prev) => (prev ? { ...prev, status: updated.status } : prev));
      }
    });
    return () => {
      if (sub) {
        supabase.removeChannel(sub);
      }
    };
  }, [restaurantId, orderId]);

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
          <p className="mt-2 text-sm text-gray-400">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  // "A caminho" só existe para entrega: numa retirada o pedido vai de "pronto"
  // direto para "entregue" e a etapa intermediária ficaria vazia para sempre.
  const isDelivery = order.delivery_type === "entrega";
  const STATUS_STEPS: OrderStatus[] = isDelivery
    ? ["received", "preparing", "ready", "out_for_delivery", "delivered"]
    : ["received", "preparing", "ready", "delivered"];
  const isCancelled = order.status === "cancelled";
  const currentStepIndex = STATUS_STEPS.indexOf(order.status);

  // Estado do pedido em uma frase, para o cliente não precisar interpretar a
  // trilha de etapas.
  const statusHint: Record<OrderStatus, string> = {
    received: "O restaurante recebeu seu pedido.",
    preparing: "Sua comanda está na cozinha.",
    ready: isDelivery ? "Pedido pronto, saindo para entrega." : "Pedido pronto para retirada.",
    out_for_delivery: "O entregador está a caminho.",
    delivered: "Pedido entregue. Bom apetite!",
    cancelled: "Pedido cancelado pelo restaurante.",
  };

  return (
    <div className="min-h-screen bg-black px-4 py-6">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold text-white">Acompanhar Pedido</h1>
          <p className="mt-1 text-sm text-gray-400">Comanda {order.comanda}</p>
          {soberaniaPoints(order.total) > 0 && (
            <div className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-400">
              ⭐ +{soberaniaPoints(order.total)} pontos de soberania
            </div>
          )}
        </div>

        {/* Status badge */}
        <div className="mb-6 text-center">
          <span
            className={`inline-block rounded-full border px-4 py-2 text-sm font-bold ${ORDER_STATUS_COLORS[order.status]}`}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </span>
          <p className="mt-2 text-xs text-gray-500">{statusHint[order.status]}</p>
        </div>

        {isCancelled && (
          <div className="mb-6 rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-center">
            <p className="text-xs text-red-200/80">
              O restaurante cancelou este pedido. Em caso de dúvida, fale diretamente com a loja.
            </p>
          </div>
        )}

        {/* Progress steps */}
        {!isCancelled && (
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
                        isCompleted ? "border-cyan-500 bg-cyan-500/20" : "border-gray-700 bg-black"
                      } flex items-center justify-center`}
                    >
                      {isCompleted ? (
                        <span className="text-lg">{STEP_ICONS[step]}</span>
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
                      {isCurrent && <p className="text-[10px] text-cyan-400">Status atual</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order details */}
        <div className="rounded-xl border border-cyan-500/20 bg-black/40 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase text-gray-500">Detalhes do pedido</h3>

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

          <div className="mt-3 border-t border-gray-800 pt-3 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Pagamento</span>
              <span className="font-semibold text-gray-200">
                {paymentMethodLabel(order.payment_method)}
              </span>
            </div>
            {order.delivery_type === "entrega" && Number(order.delivery_fee) > 0 && (
              <div className="mt-1 flex justify-between">
                <span>Taxa de entrega</span>
                <span className="font-semibold text-gray-200">
                  {brl(Number(order.delivery_fee))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Histórico de status — já era buscado mas nunca aparecia na tela */}
        {history.length > 0 && (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4">
            <h3 className="mb-3 text-xs font-bold uppercase text-gray-500">Linha do tempo</h3>
            <ol className="space-y-3">
              {[...history]
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((h, i) => (
                  <li key={`${h.status}-${h.created_at}-${i}`} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 text-base leading-none">
                      {STEP_ICONS[h.status]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white">
                        {ORDER_STATUS_LABELS[h.status]}
                      </p>
                      <p className="text-[10px] text-gray-500">{formatDate(h.created_at)}</p>
                      {h.note && <p className="mt-0.5 text-[11px] text-gray-400">{h.note}</p>}
                    </div>
                  </li>
                ))}
            </ol>
          </div>
        )}

        {/* Timestamp */}
        <p className="mt-4 text-center text-[10px] text-gray-600">
          Pedido realizado em {formatDate(order.created_at)}
        </p>
      </div>
    </div>
  );
}
