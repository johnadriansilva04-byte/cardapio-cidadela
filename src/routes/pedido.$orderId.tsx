import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Check,
  ClipboardList,
  ChefHat,
  PackageCheck,
  PartyPopper,
  SearchX,
  ShoppingBag,
} from "lucide-react";
import {
  getOrderTrackingPublic,
  getOrderHistory,
  subscribeToOrders,
} from "@/modules/supabase/orders";
import { supabase } from "@/modules/supabase/client";
import { brl, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/types";
import type { Order, OrderStatus } from "@/lib/types";

export const Route = createFileRoute("/pedido/$orderId")({
  head: () => ({
    meta: [{ title: "Acompanhar Pedido" }],
  }),
  component: OrderTrackingPage,
});

const STATUS_STEPS: { status: OrderStatus; label: string; icon: typeof Check }[] = [
  { status: "received", label: "Recebido", icon: ClipboardList },
  { status: "preparing", label: "Preparando", icon: ChefHat },
  { status: "ready", label: "Pronto", icon: PackageCheck },
  { status: "delivered", label: "Entregue", icon: PartyPopper },
];

const STEP_HINTS: Partial<Record<OrderStatus, string>> = {
  received: "A cozinha já foi avisada do seu pedido.",
  preparing: "Seu pedido está sendo preparado agora.",
  ready: "Tudo pronto! Já está saindo.",
  delivered: "Pedido finalizado. Bom apetite!",
  out_for_delivery: "Saiu para entrega — já está a caminho!",
  cancelled: "Este pedido foi cancelado.",
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

  // Subscribe to status updates
  useEffect(() => {
    if (!order) return;
    const sub = subscribeToOrders(order.restaurant_id, (_eventType, updated) => {
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070b]">
        <div className="size-8 animate-spin rounded-full border-2 border-cyan-400/80 border-t-transparent" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070b] px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <SearchX className="size-6 text-gray-500" />
          </div>
          <h1 className="mt-4 text-lg font-bold text-white">Pedido não encontrado</h1>
          <p className="mt-1.5 text-sm text-gray-500">Verifique o link e tente novamente.</p>
          <Link
            to="/meus-pedidos"
            search={{ from: undefined }}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/[0.08]"
          >
            <ShoppingBag className="size-4" /> Meus pedidos
          </Link>
        </div>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.status === order.status);
  const isCanceled = order.status === "cancelled";
  const hint = STEP_HINTS[order.status];
  const currentIcon = currentStepIndex >= 0 ? STATUS_STEPS[currentStepIndex].icon : ClipboardList;

  return (
    <div className="min-h-screen bg-[#07070b] px-4 py-8">
      <div className="mx-auto max-w-md space-y-5">
        {/* Header */}
        <header className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
            Pedido {order.comanda}
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </h1>
          {hint && !isCanceled && <p className="mt-1.5 text-sm text-gray-400">{hint}</p>}
          {isCanceled && <p className="mt-1.5 text-sm text-red-300/80">{STEP_HINTS.cancelled}</p>}
        </header>

        {/* Progress — horizontal stepper */}
        {!isCanceled && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="flex items-center">
              {STATUS_STEPS.map((step, idx) => {
                const done = currentStepIndex >= 0 && idx < currentStepIndex;
                const current = idx === currentStepIndex;
                const Icon = step.icon;
                return (
                  <div key={step.status} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <span
                        className={`grid size-9 place-items-center rounded-full border transition-colors ${
                          done
                            ? "border-cyan-500/60 bg-cyan-500/20 text-cyan-300"
                            : current
                              ? "border-cyan-400 bg-cyan-500 text-white"
                              : "border-white/10 bg-white/[0.03] text-gray-600"
                        }`}
                      >
                        {done ? (
                          <Check className="size-4" />
                        ) : (
                          <Icon className={`size-4 ${current ? "" : ""}`} />
                        )}
                      </span>
                      <span
                        className={`whitespace-nowrap text-[10px] font-semibold ${
                          done || current ? "text-gray-200" : "text-gray-600"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < STATUS_STEPS.length - 1 && (
                      <span
                        className={`mx-1.5 mb-5 h-0.5 flex-1 rounded-full transition-colors ${
                          done ? "bg-cyan-500/70" : "bg-white/[0.07]"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Receipt */}
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-500">
            Resumo
          </h2>

          {order.order_items && order.order_items.length > 0 && (
            <ul className="mt-3 divide-y divide-white/[0.05]">
              {order.order_items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0 text-gray-300">
                    <span className="font-semibold text-white">{item.quantity}×</span>{" "}
                    {item.product_name}
                  </span>
                  <span className="shrink-0 font-semibold text-white">{brl(item.total)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-1 space-y-1.5 border-t border-white/[0.06] pt-3 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{brl(order.subtotal)}</span>
            </div>
            {order.delivery_fee > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Taxa de entrega</span>
                <span>{brl(order.delivery_fee)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-white">
              <span>Total</span>
              <span>{brl(order.total)}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-gray-400">
              {order.delivery_type === "entrega" ? "Entrega" : "Retirada"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium capitalize text-gray-400">
              {order.payment_method}
            </span>
          </div>

          {order.delivery_type === "entrega" && order.delivery_address && (
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              {order.delivery_address}
              {order.customer_complement ? `, ${order.customer_complement}` : ""}
            </p>
          )}

          {order.observations && (
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              <span className="font-semibold text-gray-400">Obs.:</span> {order.observations}
            </p>
          )}
        </section>

        {/* History (quando houver) */}
        {history.length > 1 && (
          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-500">
              Linha do tempo
            </h2>
            <ul className="mt-2 space-y-1.5">
              {[...history].reverse().map((h, i) => (
                <li
                  key={`${h.created_at}-${i}`}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="text-gray-300">{ORDER_STATUS_LABELS[h.status] ?? h.status}</span>
                  <span className="text-gray-600">{formatDate(h.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="pb-2 text-center text-[11px] text-gray-600">
          Pedido realizado em {formatDate(order.created_at)}
        </p>
      </div>
    </div>
  );
}
