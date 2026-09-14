import { useEffect, useState, useCallback, useMemo } from "react";
import {
  RefreshCw,
  Printer,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Phone,
  MapPin,
  MessageCircle,
  User,
  CreditCard,
  ShoppingBag,
  AlertCircle,
  Search,
  Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Restaurant, Order, OrderStatus } from "@/lib/types";
import {
  brl,
  buildThermalTicket,
  buildWhatsAppMessage,
  printTicket,
  sendToWhatsApp,
  formatDate,
} from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/types";
import {
  getOrdersByRestaurant,
  updateOrderStatus,
} from "@/modules/supabase/orders";
import { supabase } from "@/modules/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const OPERATIONAL_STATUSES: OrderStatus[] = [
  "received",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  received: "preparing",
  preparing: "ready",
  ready: "out_for_delivery",
  out_for_delivery: "delivered",
  delivered: null,
  cancelled: null,
};

type PeriodKey = "today" | "7d" | "30d" | "all";

function periodStart(period: PeriodKey): Date | null {
  if (period === "all") return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "today") return d;
  if (period === "7d") {
    d.setDate(d.getDate() - 7);
    return d;
  }
  d.setDate(d.getDate() - 30);
  return d;
}

export function OrderManager({ restaurant }: { restaurant: Restaurant }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrdersByRestaurant(restaurant.id);
      setOrders(data);
    } catch (e) {
      console.error("[OrderManager] load", e);
      setError("Falha ao carregar pedidos.");
    } finally {
      setLoading(false);
    }
  }, [restaurant.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getOrdersByRestaurant(restaurant.id);
        if (!cancelled) setOrders(data);
      } catch (e) {
        console.error("[OrderManager] initial load", e);
        if (!cancelled) setError("Falha ao carregar pedidos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurant.id]);

  // Realtime distinto para não colidir com o badge do layout (admin.tsx usa orders_${id})
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    channel = supabase
      .channel(`orders_pedidos_${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` },
        (payload) => {
          const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
          const row = (payload.new ?? payload.old) as Order | undefined;
          if (!row) return;
          if (eventType === "INSERT") {
            setOrders((prev) => {
              if (prev.some((o) => o.id === row.id)) return prev;
              return [payload.new as Order, ...prev];
            });
          } else if (eventType === "UPDATE") {
            setOrders((prev) => prev.map((o) => (o.id === (payload.new as Order).id ? ({ ...o, ...(payload.new as Order) } as Order) : o)));
          } else if (eventType === "DELETE") {
            const oldId = (payload.old as { id: string }).id;
            setOrders((prev) => prev.filter((o) => o.id !== oldId));
          }
        },
      )
      .subscribe();

    poll = setInterval(() => {
      // fallback polling silencioso quando realtime falhar
      getOrdersByRestaurant(restaurant.id).then((data) => {
        // só atualiza se tamanho/status mudou para evitar piscar
        setOrders((prev) => {
          if (prev.length !== data.length) return data;
          const prevMap = new Map(prev.map((o) => [o.id, o.status]));
          const changed = data.some((d) => prevMap.get(d.id) !== d.status);
          return changed ? data : prev;
        });
      }).catch(() => {});
    }, 15000);

    return () => {
      if (poll) clearInterval(poll);
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* ignore */ }
      }
    };
  }, [restaurant.id]);

  async function changeStatus(orderId: string, status: OrderStatus) {
    const ok = await updateOrderStatus(orderId, status);
    if (ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status, updated_at: new Date().toISOString() } : o)),
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

  function contactWhatsApp(order: Order) {
    const phone = order.customer_phone?.replace(/\D/g, "");
    if (!phone || phone.length < 10) {
      alert("Telefone do cliente não disponível");
      return;
    }
    const msg = buildWhatsAppMessage(
      {
        comanda: order.comanda,
        customer_name: order.customer_name,
        total: order.total,
        order_items: order.order_items,
        observations: order.observations || "",
        payment_method: order.payment_method,
        delivery_type: order.delivery_type,
        delivery_address: order.delivery_address || "",
      },
      restaurant.name,
    );
    sendToWhatsApp(phone, msg);
  }

  const statusCounts = useMemo(() => orders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  ), [orders]);

  const displayedOrders = useMemo(() => {
    let list = [...orders];
    const start = periodStart(period);
    if (start) {
      const ts = start.getTime();
      list = list.filter((o) => new Date(o.created_at).getTime() >= ts);
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((o) =>
        o.comanda.toLowerCase().includes(needle) ||
        o.customer_name.toLowerCase().includes(needle) ||
        o.customer_phone.toLowerCase().includes(needle) ||
        o.id.toLowerCase().includes(needle),
      );
    }
    if (filter !== "all") {
      list = list.filter((o) => o.status === filter);
    } else {
      list.sort((a, b) => {
        const priority: Record<string, number> = {
          received: 0,
          preparing: 1,
          ready: 2,
          out_for_delivery: 3,
          delivered: 4,
          cancelled: 5,
        };
        return (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
      });
    }
    return list;
  }, [orders, period, q, filter]);

  if (loading && orders.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="size-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertCircle className="mx-auto size-8 text-red-400" />
        <p className="mt-3 text-sm text-red-300">{error}</p>
        <button
          onClick={loadOrders}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
        >
          <RefreshCw className="size-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* compact status stats */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {OPERATIONAL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? "all" : s)}
            className={`rounded-xl border p-2.5 text-center transition-all sm:p-3 ${
              filter === s
                ? "border-cyan-500 bg-cyan-500/15 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                : "border-white/5 bg-white/[0.02] hover:border-white/10"
            }`}
          >
            <p className="text-xl font-black text-white sm:text-2xl">
              {statusCounts[s] ?? 0}
            </p>
            <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-gray-400 sm:text-[9px]">
              {ORDER_STATUS_LABELS[s]}
            </p>
          </button>
        ))}
      </div>

      {/* filters: busca + período */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-600" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por comanda, nome ou telefone…"
            className="border-white/10 bg-white/[0.03] pl-9 text-white placeholder:text-gray-600"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="size-3.5" /> Período
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="h-9 w-[160px] border-white/10 bg-white/[0.04] text-xs text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#1a1a22] text-white">
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={loadOrders}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />{" "}
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
        <span className="text-[11px] text-gray-500">
          {displayedOrders.length} pedido{displayedOrders.length !== 1 ? "s" : ""} • {" "}
          {filter === "all" ? "Todos" : ORDER_STATUS_LABELS[filter]}{period !== "all" ? ` • ${period === "today" ? "hoje" : period}` : ""}{q ? ` • busca: "${q}"` : ""}
        </span>
      </div>

      {displayedOrders.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] py-12 text-center">
          <ShoppingBag className="mx-auto size-8 text-gray-700" />
          <p className="mt-3 text-xs text-gray-500">
            Nenhum pedido
            {filter !== "all"
              ? ` com status "${ORDER_STATUS_LABELS[filter]}"`
              : q
                ? ` para "${q}"`
                : period !== "all"
                  ? " neste período"
                  : " — os novos pedidos aparecem aqui ao vivo"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedOrders.map((order) => {
            const next = NEXT_STATUS[order.status];
            const isExpanded = expandedId === order.id;
            const hasCustomerPhone =
              Boolean(order.customer_phone) && order.customer_phone.replace(/\D/g, "").length >= 10;

            return (
              <div
                key={order.id}
                className={`overflow-hidden rounded-xl border transition-all ${
                  order.status === "cancelled"
                    ? "border-red-500/20 bg-red-500/[0.03] opacity-60"
                    : "border-cyan-500/20 bg-black/40"
                }`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-bold ${ORDER_STATUS_COLORS[order.status]}`}
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">
                        {order.comanda}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(order.created_at).toLocaleString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-400">
                      {order.customer_name}
                      {order.customer_phone ? ` • ${order.customer_phone}` : ""}
                    </p>
                  </div>

                  <span className="shrink-0 text-sm font-bold text-cyan-400">
                    {brl(order.total)}
                  </span>

                  {isExpanded ? (
                    <ChevronUp className="size-4 shrink-0 text-gray-500" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0 text-gray-500" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-white/5 px-4 pb-4 pt-3">
                    <div className="mb-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <User className="size-3 text-gray-500" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                          Cliente
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {order.customer_name}
                      </p>
                      {order.customer_email && (
                        <p className="mt-0.5 text-xs text-gray-400">
                          {order.customer_email}
                        </p>
                      )}
                    </div>

                    <div className="mb-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <Phone className="size-3 text-gray-500" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                          Contato
                        </span>
                      </div>
                      <p className="text-sm text-white">{order.customer_phone || "—"}</p>
                      {hasCustomerPhone && (
                        <button
                          onClick={() => contactWhatsApp(order)}
                          className="mt-2 flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-400 transition-colors hover:bg-green-500/20"
                        >
                          <MessageCircle className="size-3.5" /> Chamar no WhatsApp
                        </button>
                      )}
                    </div>

                    {order.delivery_type === "entrega" ? (
                      <div className="mb-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                        <div className="mb-2 flex items-center gap-1.5">
                          <MapPin className="size-3 text-gray-500" />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                            Entrega
                          </span>
                        </div>
                        {order.delivery_address && (
                          <p className="text-sm text-white">{order.delivery_address}</p>
                        )}
                        {(order.customer_complement || order.customer_neighborhood || order.customer_city) && (
                          <div className="mt-1.5 space-y-0.5">
                            {order.customer_complement && (
                              <p className="text-xs text-gray-400">
                                <span className="text-gray-500">Complemento:</span> {order.customer_complement}
                              </p>
                            )}
                            {order.customer_neighborhood && (
                              <p className="text-xs text-gray-400">
                                <span className="text-gray-500">Bairro:</span> {order.customer_neighborhood}
                              </p>
                            )}
                            {order.customer_city && (
                              <p className="text-xs text-gray-400">
                                <span className="text-gray-500">Cidade:</span> {order.customer_city}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mb-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                        <div className="mb-2 flex items-center gap-1.5">
                          <MapPin className="size-3 text-gray-500" />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                            Retirada
                          </span>
                        </div>
                        <p className="text-sm text-white">Retirada no balcão</p>
                      </div>
                    )}

                    <div className="mb-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <ShoppingBag className="size-3 text-gray-500" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                          Pedido
                        </span>
                      </div>
                      {order.order_items && order.order_items.length > 0 && (
                        <div className="space-y-1.5">
                          {order.order_items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="min-w-0 flex-1 truncate text-gray-300">
                                <span className="font-bold text-white">{item.quantity}x</span>{" "}
                                {item.product_name}
                              </span>
                              <span className="shrink-0 font-semibold text-white">
                                {brl(item.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {order.observations && (
                        <div className="mt-2 rounded bg-black/30 p-2">
                          <p className="text-[10px] text-gray-500">Observações:</p>
                          <p className="text-xs text-gray-300">{order.observations}</p>
                        </div>
                      )}
                      <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Subtotal</span>
                          <span>{brl(order.subtotal)}</span>
                        </div>
                        {order.delivery_fee > 0 && (
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>Taxa de entrega</span>
                            <span>{brl(order.delivery_fee)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-bold text-white">
                          <span>Total</span>
                          <span>{brl(order.total)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <CreditCard className="size-3 text-gray-500" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                          Pagamento
                        </span>
                      </div>
                      <p className="text-sm font-semibold uppercase text-white">
                        {order.payment_method === "pix"
                          ? "PIX"
                          : order.payment_method === "dinheiro"
                            ? "Dinheiro"
                            : "Cartão"}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-500 capitalize">{order.payment_status?.replace(/_/g, " ")}</p>
                    </div>

                    <p className="mb-3 text-[10px] text-gray-600">
                      Pedido realizado em {formatDate(order.created_at)}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {next && (
                        <button
                          onClick={() => changeStatus(order.id, next)}
                          className="rounded-lg bg-cyan-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-cyan-500"
                        >
                          → {ORDER_STATUS_LABELS[next]}
                        </button>
                      )}

                      {order.status !== "cancelled" &&
                        order.status !== "delivered" && (
                          <button
                            onClick={() => changeStatus(order.id, "cancelled")}
                            className="rounded-lg border border-red-500/40 px-3 py-2 text-[10px] text-red-400 hover:bg-red-500/10"
                          >
                            Cancelar
                          </button>
                        )}

                      <button
                        onClick={() => printOrder(order)}
                        className="flex items-center gap-1 rounded-lg border border-cyan-500/40 px-3 py-2 text-[10px] text-cyan-300 hover:bg-cyan-500/10"
                      >
                        <Printer className="size-3" /> Imprimir
                      </button>

                      <a
                        href={`/pedido/${order.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-gray-600/40 px-3 py-2 text-[10px] text-gray-400 hover:bg-white/5"
                      >
                        <ExternalLink className="size-3" /> Rastrear
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
