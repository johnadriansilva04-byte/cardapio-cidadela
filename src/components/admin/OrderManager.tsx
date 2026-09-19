import { useEffect, useState, useCallback, useMemo } from "react";
import {
  RefreshCw,
  Printer,
  ExternalLink,
  MapPin,
  MessageCircle,
  User,
  CreditCard,
  ShoppingBag,
  AlertCircle,
  Search,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Bike,
  History,
  ChevronDown,
  Store,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { OrderStatusBadge } from "@/components/admin/StatusBadge";
import { getOrdersByRestaurant, updateOrderStatus } from "@/modules/supabase/orders";
import { supabase } from "@/modules/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

// Colunas do Kanban — ativos em ordem de fluxo; entregues e cancelados ficam no histórico
const KANBAN_COLUMNS: { status: OrderStatus; label: string; icon: typeof Clock }[] = [
  { status: "received", label: "Recebidos", icon: ShoppingBag },
  { status: "preparing", label: "Em preparo", icon: Clock },
  { status: "ready", label: "Prontos", icon: CheckCircle2 },
  { status: "out_for_delivery", label: "A caminho", icon: Bike },
];

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  received: "preparing",
  preparing: "ready",
  ready: "out_for_delivery",
  out_for_delivery: "delivered",
  delivered: null,
  cancelled: null,
};

const COLUMN_ACCENT: Record<OrderStatus, string> = {
  received: "border-sky-500/20",
  preparing: "border-amber-500/20",
  ready: "border-emerald-500/20",
  out_for_delivery: "border-violet-500/20",
  delivered: "border-zinc-500/20",
  cancelled: "border-red-500/20",
};

const COLUMN_HEAD_ICON: Record<OrderStatus, string> = {
  received: "text-sky-400 bg-sky-500/15",
  preparing: "text-amber-400 bg-amber-500/15",
  ready: "text-emerald-400 bg-emerald-500/15",
  out_for_delivery: "text-violet-400 bg-violet-500/15",
  delivered: "text-zinc-400 bg-zinc-500/15",
  cancelled: "text-red-400 bg-red-500/15",
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

export function OrderManager({
  restaurants,
  initialStoreId,
}: {
  restaurants: Restaurant[];
  initialStoreId?: string;
}) {
  const restaurantIds = useMemo(() => restaurants.map((r) => r.id), [restaurants]);
  const restaurantNames = useMemo(
    () => new Map(restaurants.map((r) => [r.id, r.name])),
    [restaurants],
  );
  const multi = restaurants.length > 1;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [storeFilter, setStoreFilter] = useState<string>(initialStoreId ?? "all");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [detail, setDetail] = useState<Order | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const fetchAllOrders = useCallback(async (): Promise<Order[]> => {
    if (restaurantIds.length === 0) return [];
    const batches = await Promise.all(restaurantIds.map((id) => getOrdersByRestaurant(id)));
    return batches
      .flat()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [restaurantIds]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await fetchAllOrders());
    } catch (e) {
      console.error("[OrderManager] load", e);
      setError("Falha ao carregar pedidos.");
    } finally {
      setLoading(false);
    }
  }, [fetchAllOrders]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAllOrders();
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
  }, [fetchAllOrders]);

  // Realtime distinto para não colidir com o badge do layout (admin.tsx usa orders_${id})
  useEffect(() => {
    const channels: RealtimeChannel[] = [];
    let poll: ReturnType<typeof setInterval> | null = null;

    const applyInsert = (row: Order) => {
      setOrders((prev) => {
        if (prev.some((o) => o.id === row.id)) return prev;
        return [row, ...prev];
      });
    };

    for (const id of restaurantIds) {
      const channel = supabase
        .channel(`orders_pedidos_${id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${id}` },
          (payload) => {
            const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
            const row = (payload.new ?? payload.old) as Order | undefined;
            if (!row) return;
            if (eventType === "INSERT") {
              applyInsert(payload.new as Order);
            } else if (eventType === "UPDATE") {
              setOrders((prev) =>
                prev.map((o) =>
                  o.id === (payload.new as Order).id
                    ? ({ ...o, ...(payload.new as Order) } as Order)
                    : o,
                ),
              );
            } else if (eventType === "DELETE") {
              const oldId = (payload.old as { id: string }).id;
              setOrders((prev) => prev.filter((o) => o.id !== oldId));
            }
          },
        )
        .subscribe();
      channels.push(channel);
    }

    poll = setInterval(() => {
      // fallback polling silencioso quando realtime falhar
      fetchAllOrders()
        .then((data) => {
          // só atualiza se tamanho/status mudou para evitar piscar
          setOrders((prev) => {
            if (prev.length !== data.length) return data;
            const prevMap = new Map(prev.map((o) => [o.id, o.status]));
            const changed = data.some((d) => prevMap.get(d.id) !== d.status);
            return changed ? data : prev;
          });
        })
        .catch(() => {});
    }, 15000);

    return () => {
      if (poll) clearInterval(poll);
      for (const channel of channels) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [restaurantIds, fetchAllOrders]);

  async function changeStatus(orderId: string, status: OrderStatus) {
    const ok = await updateOrderStatus(orderId, status);
    if (ok) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status, updated_at: new Date().toISOString() } : o,
        ),
      );
    }
  }

  function requestCancel(order: Order) {
    if (!window.confirm(`Cancelar o pedido ${order.comanda}?`)) return;
    changeStatus(order.id, "cancelled");
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
        delivery_fee: order.delivery_fee ?? 0,
        payment_method: order.payment_method,
        order_items: order.order_items?.map((i) => ({
          product_name: i.product_name,
          quantity: i.quantity,
          total: i.total,
          notes: (i as unknown as { notes?: string }).notes ?? "",
        })),
        created_at: order.created_at,
      },
      restaurantNames.get(order.restaurant_id) ?? "",
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
        delivery_fee: order.delivery_fee || 0,
      },
      restaurantNames.get(order.restaurant_id) ?? "",
    );
    sendToWhatsApp(phone, msg);
  }

  const statusCounts = useMemo(
    () =>
      orders.reduce(
        (acc, o) => {
          acc[o.status] = (acc[o.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [orders],
  );

  const displayedOrders = useMemo(() => {
    let list = [...orders];
    if (storeFilter !== "all") {
      list = list.filter((o) => o.restaurant_id === storeFilter);
    }
    const start = periodStart(period);
    if (start) {
      const ts = start.getTime();
      list = list.filter((o) => new Date(o.created_at).getTime() >= ts);
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (o) =>
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
  }, [orders, period, q, filter, storeFilter]);

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
      {/* Atalhos de filtro — apenas fluxo operacional (entregues/cancelados seguem no histórico) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {KANBAN_COLUMNS.map((s) => (
          <button
            key={s.status}
            onClick={() => setFilter(filter === s.status ? "all" : s.status)}
            className={`rounded-xl border p-2.5 text-center transition-all sm:p-3 ${
              filter === s.status
                ? "border-cyan-500 bg-cyan-500/15 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                : "border-white/5 bg-white/[0.02] hover:border-white/10"
            }`}
          >
            <p className="text-xl font-black text-white sm:text-2xl">
              {statusCounts[s.status] ?? 0}
            </p>
            <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-gray-400 sm:text-[9px]">
              {s.label}
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
          {multi && (
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="h-9 w-[170px] border-white/10 bg-white/[0.04] text-xs text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#1a1a22] text-white">
                <SelectItem value="all">Todas as lojas</SelectItem>
                {restaurants.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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

      {/* Filtros rápidos adicionais */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setPeriod("today")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            period === "today"
              ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
              : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
          }`}
        >
          Hoje
        </button>
        <button
          onClick={() => setPeriod("7d")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            period === "7d"
              ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
              : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
          }`}
        >
          7 dias
        </button>
        <button
          onClick={() => setPeriod("30d")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            period === "30d"
              ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
              : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
          }`}
        >
          30 dias
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            filter === "all"
              ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
              : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
          }`}
        >
          Todos os status
        </button>
        {q && (
          <button
            onClick={() => setQ("")}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
          >
            Limpar busca
          </button>
        )}
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
          {displayedOrders.length} pedido{displayedOrders.length !== 1 ? "s" : ""} •{" "}
          {filter === "all" ? "Todos" : ORDER_STATUS_LABELS[filter]}
          {period !== "all" ? ` • ${period === "today" ? "hoje" : period}` : ""}
          {q ? ` • busca: "${q}"` : ""}
        </span>
      </div>

      {/* Kanban: colunas de status ativo + seções entregues/cancelados */}
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
        <div className="space-y-5">
          {/* Colunas ativas */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {KANBAN_COLUMNS.map((col) => {
              const colOrders = displayedOrders.filter((o) => o.status === col.status);
              return (
                <div
                  key={col.status}
                  className={cn(
                    "flex flex-col rounded-2xl border bg-black/20",
                    COLUMN_ACCENT[col.status],
                  )}
                >
                  <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2.5">
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-lg",
                        COLUMN_HEAD_ICON[col.status],
                      )}
                    >
                      <col.icon className="size-3.5" />
                    </span>
                    <p className="flex-1 truncate text-xs font-bold uppercase tracking-widest text-gray-300">
                      {col.label}
                    </p>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">
                      {colOrders.length}
                    </span>
                  </div>
                  <div className="space-y-2 p-2">
                    {colOrders.length === 0 ? (
                      <p className="py-6 text-center text-xs text-gray-600">Sem pedidos</p>
                    ) : (
                      colOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          storeName={multi ? restaurantNames.get(order.restaurant_id) : undefined}
                          onOpen={() => setDetail(order)}
                          onAdvance={() => changeStatus(order.id, NEXT_STATUS[order.status]!)}
                          onCancel={() => requestCancel(order)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Histórico: entregues + cancelados recolhidos */}
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <div className="overflow-hidden rounded-2xl border border-white/5 bg-black/20">
              <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]">
                <span className="grid size-6 place-items-center rounded-lg bg-white/10 text-gray-300">
                  <History className="size-3.5" />
                </span>
                <span className="flex-1 truncate text-xs font-bold uppercase tracking-widest text-gray-300">
                  Histórico
                </span>
                {(function () {
                  const delivered = displayedOrders.filter((o) => o.status === "delivered");
                  const cancelled = displayedOrders.filter((o) => o.status === "cancelled");
                  return (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold">
                      {delivered.length > 0 && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                          {delivered.length} entregue{delivered.length === 1 ? "" : "s"}
                        </span>
                      )}
                      {cancelled.length > 0 && (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-300">
                          {cancelled.length} cancelado{cancelled.length === 1 ? "" : "s"}
                        </span>
                      )}
                      {delivered.length + cancelled.length === 0 && (
                        <span className="text-gray-600">sem itens no período</span>
                      )}
                    </span>
                  );
                })()}
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-gray-500 transition-transform",
                    historyOpen && "rotate-180",
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {displayedOrders.some(
                  (o) => o.status === "delivered" || o.status === "cancelled",
                ) ? (
                  <div className="grid gap-3 border-t border-white/5 p-2 lg:grid-cols-2">
                    {(["delivered", "cancelled"] as OrderStatus[]).map((s) => {
                      const colOrders = displayedOrders.filter((o) => o.status === s);
                      if (colOrders.length === 0) return null;
                      return (
                        <div key={s} className="rounded-xl bg-black/20">
                          <div className="flex items-center gap-2 px-3 py-2">
                            <span
                              className={cn(
                                "grid size-6 place-items-center rounded-lg",
                                COLUMN_HEAD_ICON[s],
                              )}
                            >
                              {s === "cancelled" ? (
                                <XCircle className="size-3.5" />
                              ) : (
                                <CheckCircle2 className="size-3.5" />
                              )}
                            </span>
                            <p className="flex-1 truncate text-xs font-bold uppercase tracking-widest text-gray-300">
                              {ORDER_STATUS_LABELS[s]}
                            </p>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">
                              {colOrders.length}
                            </span>
                          </div>
                          <div className="space-y-2 px-2 pb-2">
                            {colOrders.map((order) => (
                              <OrderCard
                                key={order.id}
                                order={order}
                                storeName={
                                  multi ? restaurantNames.get(order.restaurant_id) : undefined
                                }
                                compact
                                onOpen={() => setDetail(order)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="border-t border-white/5 px-3 py-4 text-center text-xs text-gray-600">
                    Nenhum pedido entregue ou cancelado no período.
                  </p>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>
      )}

      {/* Detalhes do pedido */}
      <OrderDetailDialog
        order={detail}
        storeName={detail ? restaurantNames.get(detail.restaurant_id) : undefined}
        onClose={() => setDetail(null)}
        onChangeStatus={changeStatus}
        onPrint={printOrder}
        onWhatsApp={contactWhatsApp}
      />
    </div>
  );
}

function OrderCard({
  order,
  storeName,
  onOpen,
  onAdvance,
  onCancel,
  compact = false,
}: {
  order: Order;
  storeName?: string;
  onOpen: () => void;
  onAdvance?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const next = NEXT_STATUS[order.status];
  const nextLabel = next ? ORDER_STATUS_LABELS[next] : null;
  return (
    <div className="group rounded-xl border border-white/8 bg-white/[0.03] p-2.5 transition-all hover:border-cyan-500/30 hover:bg-white/[0.05]">
      <button onClick={onOpen} className="flex w-full flex-col gap-1.5 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-xs font-bold text-white">{order.comanda}</span>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold",
              ORDER_STATUS_COLORS[order.status],
            )}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>
        {storeName && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold text-gray-400">
            <Store className="size-2.5" /> {storeName}
          </span>
        )}
        <p className="truncate text-[11px] text-gray-400">{order.customer_name}</p>
        {!compact && order.order_items && order.order_items.length > 0 && (
          <p className="line-clamp-2 text-[10px] leading-relaxed text-gray-500">
            {order.order_items
              .slice(0, 3)
              .map((i) => `${i.quantity}x ${i.product_name}`)
              .join(" • ")}
            {order.order_items.length > 3 ? ` • +${order.order_items.length - 3}` : ""}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs font-black text-cyan-400">{brl(order.total)}</span>
          <span className="text-[9px] text-gray-600">
            {new Date(order.created_at).toLocaleString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
        </div>
      </button>
      {onCancel && order.status !== "cancelled" && order.status !== "delivered" && !compact && (
        <div className="mt-2 flex items-center gap-1.5">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[10px] font-bold text-red-300 transition-colors hover:bg-red-500/20"
          >
            Cancelar
          </button>
          {onAdvance && next && (
            <button
              onClick={onAdvance}
              className="flex-1 rounded-lg bg-cyan-500/15 px-2 py-1.5 text-[10px] font-bold text-cyan-300 transition-colors hover:bg-cyan-500 hover:text-black"
            >
              → {nextLabel}
            </button>
          )}
        </div>
      )}
      {!onCancel && onAdvance && next && !compact && (
        <button
          onClick={onAdvance}
          className="mt-2 w-full rounded-lg bg-cyan-500/15 px-2 py-1.5 text-[10px] font-bold text-cyan-300 transition-colors hover:bg-cyan-500 hover:text-black"
        >
          → {nextLabel} avança
        </button>
      )}
    </div>
  );
}

function OrderDetailDialog({
  order,
  storeName,
  onClose,
  onChangeStatus,
  onPrint,
  onWhatsApp,
}: {
  order: Order | null;
  storeName?: string;
  onClose: () => void;
  onChangeStatus: (id: string, status: OrderStatus) => void;
  onPrint: (o: Order) => void;
  onWhatsApp: (o: Order) => void;
}) {
  if (!order) return null;
  const next = NEXT_STATUS[order.status];
  const hasCustomerPhone =
    Boolean(order.customer_phone) && order.customer_phone.replace(/\D/g, "").length >= 10;

  return (
    <Dialog open={Boolean(order)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#0f0f14] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <span className="font-mono text-lg">{order.comanda}</span>
            <OrderStatusBadge status={order.status} />
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            {storeName ? `${storeName} • ` : ""}Pedido de {order.customer_name} •{" "}
            {formatDate(order.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Cliente */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
              <User className="size-3" /> Cliente
            </p>
            <p className="text-sm font-semibold text-white">{order.customer_name}</p>
            {order.customer_email && (
              <p className="mt-0.5 text-xs text-gray-400">{order.customer_email}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">{order.customer_phone || "—"}</p>
            {hasCustomerPhone && (
              <button
                onClick={() => onWhatsApp(order)}
                className="mt-2 flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-400 transition-colors hover:bg-green-500/20"
              >
                <MessageCircle className="size-3.5" /> Chamar no WhatsApp
              </button>
            )}
          </div>

          {/* Entrega */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
              <MapPin className="size-3" />{" "}
              {order.delivery_type === "entrega" ? "Entrega" : "Retirada"}
            </p>
            {order.delivery_type === "entrega" ? (
              <>
                <p className="text-sm text-white">{order.delivery_address || "—"}</p>
                {(order.customer_complement ||
                  order.customer_neighborhood ||
                  order.customer_city) && (
                  <p className="mt-1 text-xs text-gray-400">
                    {[order.customer_complement, order.customer_neighborhood, order.customer_city]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-white">Retirada no balcão</p>
            )}
          </div>

          {/* Itens */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
              <ShoppingBag className="size-3" /> Pedido
            </p>
            {order.order_items && order.order_items.length > 0 && (
              <div className="space-y-2">
                {order.order_items.map((item) => {
                  const notes = (item as unknown as { notes?: string }).notes ?? "";
                  const hasAddons = notes.toLowerCase().includes("adicionais:");
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-white/[0.04] bg-black/20 px-2.5 py-2"
                    >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 flex-1 truncate text-gray-200">
                          <span className="font-bold text-white">{item.quantity}x</span>{" "}
                          {item.product_name}
                        </span>
                        <span className="shrink-0 font-bold text-white">{brl(item.total)}</span>
                      </div>
                      {notes && (
                        <p
                          className={`mt-1 rounded-md px-2 py-1 text-[11px] leading-relaxed ${hasAddons ? "border border-violet-500/20 bg-violet-500/10 text-violet-200" : "bg-white/[0.04] text-gray-400"}`}
                        >
                          {notes}
                        </p>
                      )}
                    </div>
                  );
                })}
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

          {/* Pagamento */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
              <CreditCard className="size-3" /> Pagamento
            </p>
            <p className="text-sm font-semibold uppercase text-white">
              {order.payment_method === "pix"
                ? "PIX"
                : order.payment_method === "dinheiro"
                  ? "Dinheiro"
                  : "Cartão"}
            </p>
            <p className="mt-1 text-[11px] text-gray-500 capitalize">
              {order.payment_status?.replace(/_/g, " ")}
            </p>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-1">
            {next && (
              <button
                onClick={() => onChangeStatus(order.id, next)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500"
              >
                <CheckCircle2 className="size-3.5" /> {ORDER_STATUS_LABELS[next]}
              </button>
            )}
            {order.status !== "cancelled" && order.status !== "delivered" && (
              <button
                onClick={() => onChangeStatus(order.id, "cancelled")}
                className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={() => onPrint(order)}
              className="flex items-center gap-1 rounded-lg border border-cyan-500/40 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-500/10"
            >
              <Printer className="size-3" /> Imprimir
            </button>
            <a
              href={`/pedido/${order.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-gray-600/40 px-3 py-2 text-xs text-gray-400 hover:bg-white/5"
            >
              <ExternalLink className="size-3" /> Rastrear
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
