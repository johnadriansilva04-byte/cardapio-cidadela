import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ShoppingBag, PackageOpen, ExternalLink, ArrowLeft, RefreshCw, Clock } from "lucide-react";
import { getMyOrders, isOrderClosed, pruneClosedOrderIds, getGuestId } from "@/lib/guestOrder";
import { subscribeToOrders } from "@/modules/supabase/orders";
import { supabase } from "@/modules/supabase/client";
import { brl, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, type GuestOrderSummary } from "@/lib/types";

export const Route = createFileRoute("/meus-pedidos")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  head: () => ({
    meta: [{ title: "Meus pedidos — Cardápio Cidadela" }],
  }),
  component: MyOrdersPage,
});

function MyOrdersPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<GuestOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Slug do restaurante de onde o cliente voltou (ex.: /cardapio/meu-restaurante)
  const from = search.from;

  function goBack() {
    if (from) {
      navigate({ to: "/cardapio/$slug", params: { slug: from } });
    } else {
      navigate({ to: "/", replace: true });
    }
  }
  const [refreshing, setRefreshing] = useState(false);
  const subscribedRoomsRef = useRef(new Set<string>());
  const ordersRef = useRef<GuestOrderSummary[]>([]);
  ordersRef.current = orders;

  function applyUpdate(id: string, status: GuestOrderSummary["status"]) {
    const found = ordersRef.current.some((o) => o.id === id);
    if (!found) return;
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    const list = await getMyOrders();
    if (refresh) setRefreshing(false);
    // Poda local: pedidos entregues/cancelados somem após alguns dias
    pruneClosedOrderIds(list);
    setOrders(list);
    if (!refresh) setLoading(false);
  }

  // Carrega lista inicial
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await getMyOrders();
      if (!alive) return;
      pruneClosedOrderIds(list);
      setOrders(list);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Pull-to-refresh manual
  useEffect(() => {
    const handleFocus = () => {
      if (!loading) void load(true);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loading]);

  // Tempo real: inscreve-se nos restaurantes dos pedidos (uma vez por sala)
  useEffect(() => {
    const restaurantIds = [...new Set(orders.map((o) => o.restaurant_id))];
    const channels: ReturnType<typeof supabase.channel>[] = [];
    for (const rid of restaurantIds) {
      if (subscribedRoomsRef.current.has(rid)) continue;
      subscribedRoomsRef.current.add(rid);
      try {
        const ch = subscribeToOrders(rid, (_eventType, updated) => {
          applyUpdate(updated.id, updated.status);
        });
        if (ch) channels.push(ch);
      } catch {
        /* canal individual falhou — segue */
      }
    }
    return () => {
      channels.forEach((c) => {
        try {
          supabase.removeChannel(c);
        } catch {
          /* ignore */
        }
      });
    };
  }, [orders]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-400">Carregando seus pedidos...</p>
        </div>
      </div>
    );
  }

  if (!getGuestId()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <PackageOpen className="size-7 text-gray-500" />
          </div>
          <h1 className="text-lg font-bold text-white">Nenhum pedido por aqui ainda</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            Quando você fizer um pedido em um cardápio, ele aparece aqui para você acompanhar em
            tempo real.
          </p>
          <Link
            to={from ? "/cardapio/$slug" : "/"}
            params={from ? { slug: from } : undefined}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-500"
          >
            <ArrowLeft className="size-4" />
            {from ? "Voltar ao cardápio" : "Voltar ao início"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={goBack}
              className="grid size-9 place-items-center rounded-lg border border-white/10 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Voltar"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Meus pedidos</h1>
              <p className="text-xs text-gray-500">Acompanhe em tempo real</p>
            </div>
          </div>
          <button
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
            <PackageOpen className="mx-auto size-10 text-gray-700" />
            <p className="mt-3 text-sm font-semibold text-white">Nenhum pedido ainda</p>
            <p className="mt-1 text-sm text-gray-500">
              Seus pedidos futuros aparecerão aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: GuestOrderSummary }) {
  const closed = isOrderClosed(order.status);
  return (
    <Link
      to="/pedido/$orderId"
      params={{ orderId: order.id }}
      className={`block rounded-2xl border p-4 transition-colors ${
        closed
          ? "border-white/[0.06] bg-white/[0.02] opacity-70 hover:opacity-100"
          : "border-white/10 bg-white/[0.03] hover:border-cyan-500/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-4 shrink-0 text-cyan-400" />
            <p className="truncate text-sm font-bold text-white">
              {order.restaurant_name || "Restaurante"}
            </p>
          </div>
          <p className="mt-0.5 text-xs font-medium text-gray-400">Comanda {order.comanda}</p>
        </div>
        <span
          className={`inline-block shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${ORDER_STATUS_COLORS[order.status]}`}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {formatDate(order.created_at)}
          </span>
          <span className="capitalize">{order.payment_method}</span>
          <span className="uppercase">{order.delivery_type}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-white">{brl(order.total)}</span>
          <ExternalLink className="size-3.5 text-gray-500" />
        </div>
      </div>
    </Link>
  );
}
