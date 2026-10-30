import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "@tanstack/react-router";
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
  ChefHat,
  Store,
  Sparkles,
  Lock,
  ArrowRight,
  LayoutGrid,
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
import { PREMIUM_PRICE_LABEL } from "@/lib/pricing";
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
import { KitchenMode } from "@/components/admin/KitchenMode";
import { ProgressiveList } from "@/modules/ui/ProgressiveList";
import {
  getOrdersByRestaurant,
  getOrderForOwner,
  getOwnerLockedStores,
  updateOrderStatus,
} from "@/modules/supabase/orders";
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
  // A visão inicial é "Recebidos": é o que o operador precisa ver ao abrir.
  const [filter, setFilter] = useState<OrderStatus | "all">("received");
  const [storeFilter, setStoreFilter] = useState<string>(initialStoreId ?? "all");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [detailPreview, setDetailPreview] = useState<Order | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailBlocked, setDetailBlocked] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [lockedStores, setLockedStores] = useState<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [kitchenOpen, setKitchenOpen] = useState(false);

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
      const [data, locked] = await Promise.all([fetchAllOrders(), getOwnerLockedStores()]);
      setOrders(data);
      setLockedStores(locked);
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
        const [data, locked] = await Promise.all([fetchAllOrders(), getOwnerLockedStores()]);
        if (!cancelled) {
          setOrders(data);
          setLockedStores(locked);
        }
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
    const freshTimers = new Set<ReturnType<typeof setTimeout>>();

    const applyInsert = (row: Order) => {
      setOrders((prev) => {
        if (prev.some((o) => o.id === row.id)) return prev;
        return [row, ...prev];
      });
      // Realça o que acabou de chegar e limpa depois de um tempo — o dono que
      // está olhando a tela precisa ver o pedido novo sem caçar na coluna.
      setFreshIds((prev) => new Set(prev).add(row.id));
      const timer = setTimeout(() => {
        freshTimers.delete(timer);
        setFreshIds((prev) => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
      }, 15000);
      freshTimers.add(timer);
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
      // Limpa os realces pendentes: sem isso o timeout dispara após o unmount.
      for (const t of freshTimers) clearTimeout(t);
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

  // Abre o detalhe: a lista só traz o resumo do pedido; os dados comerciais
  // (cliente, endereço, itens) vêm de `getOrderForOwner`, que aplica o bloqueio
  // do plano no banco. Enquanto carrega, mostramos o preview já com o status.
  async function openDetail(order: Order) {
    setDetailPreview(order);
    setDetailOrder(null);
    setDetailBlocked(false);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await getOrderForOwner(order.id);
      if (res.blocked) {
        setDetailBlocked(true);
      } else if (res.order) {
        setDetailOrder(res.order);
      } else setDetailError("Não foi possível carregar este pedido.");
    } catch {
      setDetailError("Não foi possível carregar este pedido.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailPreview(null);
    setDetailOrder(null);
    setDetailBlocked(false);
    setDetailError(null);
    setDetailLoading(false);
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

  const lockedCount = useMemo(
    () => orders.filter((o) => lockedStores.has(o.restaurant_id)).length,
    [orders, lockedStores],
  );

  // ---- Abas por status -------------------------------------------------------
  // Antes as quatro colunas do Kanban ficavam todas abertas ao mesmo tempo: os
  // "Recebidos" — o que o operador precisa ver primeiro — eram espremidos em um
  // quarto da largura. Agora cada status é uma aba e ocupa a tela inteira; os
  // "Recebidos" são a visão inicial. As ações e transições são as mesmas.
  const KANBAN_ICON: Record<OrderStatus, typeof Clock> = {
    received: ShoppingBag,
    preparing: Clock,
    ready: CheckCircle2,
    out_for_delivery: Bike,
    delivered: CheckCircle2,
    cancelled: XCircle,
  };
  const TAB_ORDER: (OrderStatus | "all")[] = [
    "received",
    "preparing",
    "ready",
    "out_for_delivery",
    "all",
    "delivered",
    "cancelled",
  ];
  const TAB_LABEL: Record<string, string> = {
    received: "Recebidos",
    preparing: "Em preparo",
    ready: "Prontos",
    out_for_delivery: "A caminho",
    delivered: "Entregues",
    cancelled: "Cancelados",
    all: "Todos",
  };
  const TAB_TONE: Record<string, string> = {
    received: "border-sky-500/40 bg-sky-500/15 text-sky-300",
    preparing: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    ready: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    out_for_delivery: "border-violet-500/40 bg-violet-500/15 text-violet-300",
    delivered: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
    cancelled: "border-red-500/40 bg-red-500/15 text-red-300",
    all: "border-cyan-500/40 bg-cyan-500/15 text-cyan-300",
  };

  // Ordem de exibição: no "Todos", prioridade operacional (recebido → ... →
  // histórico); nas demais abas, mais recente primeiro.
  const tabOrders = useMemo(() => {
    if (filter === "all") {
      const priority: Record<string, number> = {
        received: 0,
        preparing: 1,
        ready: 2,
        out_for_delivery: 3,
        delivered: 4,
        cancelled: 5,
      };
      return [...displayedOrders].sort((a, b) => {
        const p = (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
        return p !== 0 ? p : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return [...displayedOrders].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [displayedOrders, filter]);

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
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Aviso no topo: sem ele o dono só descobria o bloqueio ao abrir um
          pedido. Só aparece quando há loja estourada; o texto agora deixa claro
          que só os itens ficam ocultos — o resto do pedido segue visível. */}
      {lockedStores.size > 0 && (
        <Link
          to="/admin/assinatura"
          className="tap flex shrink-0 items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-2.5 transition-colors hover:bg-amber-500/[0.12]"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-300">
            <Lock className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-amber-200">
              Limite do plano gratuito atingido
            </span>
            <span className="mt-0.5 block text-[11px] text-amber-200/75">
              {lockedCount > 0
                ? `${lockedCount} pedido${lockedCount === 1 ? "" : "s"} com os itens ocultos. `
                : ""}
              Os pedidos continuam chegando e seguem gerenciáveis — só a lista de itens fica
              bloqueada.
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 self-center rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold text-black">
            Assinar <ArrowRight className="size-3" />
          </span>
        </Link>
      )}

      {/* Abas de status — a navegação da fila. Cada aba ocupa a tela inteira. */}
      <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5">
        {TAB_ORDER.map((key) => {
          const count =
            key === "all"
              ? displayedOrders.length
              : displayedOrders.filter((o) => o.status === key).length;
          const active = filter === key;
          const Icon = key === "all" ? LayoutGrid : KANBAN_ICON[key as OrderStatus];
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors",
                active
                  ? TAB_TONE[key]
                  : "border-white/8 bg-white/[0.02] text-gray-400 hover:border-white/15 hover:text-gray-200",
              )}
            >
              <Icon className="size-3.5" />
              <span>{TAB_LABEL[key]}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-black",
                  active ? "bg-black/25" : "bg-white/10 text-gray-300",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barra de controle: busca, loja, período, atualizar e Modo Cozinha. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-600" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar comanda, nome ou telefone…"
            className="h-9 border-white/10 bg-white/[0.03] pl-8 pr-8 text-sm text-white placeholder:text-gray-600"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-white"
              aria-label="Limpar busca"
            >
              <XCircle className="size-4" />
            </button>
          )}
        </div>
        {multi && (
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="h-9 w-[150px] border-white/10 bg-white/[0.04] text-xs text-white">
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
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
          <SelectTrigger className="h-9 w-[130px] border-white/10 bg-white/[0.04] text-xs text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#1a1a22] text-white">
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={loadOrders}
          disabled={loading}
          className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-cyan-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-50"
          aria-label="Atualizar"
          title="Atualizar"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </button>
        <button
          onClick={() => setKitchenOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-cyan-500 px-3 text-[11px] font-black uppercase tracking-wide text-black transition-colors hover:bg-cyan-400"
        >
          <ChefHat className="size-3.5" /> Cozinha
        </button>
      </div>

      {/* Grade compacta: os pedidos da aba atual, com o painel rolando por
          dentro (a página não cresce). */}
      <div className="min-h-0 flex-1">
        {tabOrders.length === 0 ? (
          <div className="grid h-full place-items-center rounded-xl border border-white/5 bg-white/[0.02]">
            <div className="text-center">
              <ShoppingBag className="mx-auto size-7 text-gray-700" />
              <p className="mt-2 text-xs text-gray-500">
                Nenhum pedido
                {filter !== "all"
                  ? ` em "${TAB_LABEL[filter]}"`
                  : q
                    ? ` para "${q}"`
                    : period !== "all"
                      ? " neste período"
                      : " — os novos aparecem aqui ao vivo"}
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto pb-1 pr-0.5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {tabOrders.map((order) => {
                const locked = lockedStores.has(order.restaurant_id);
                return (
                  <OrderCard
                    key={order.id}
                    order={order}
                    storeName={multi ? restaurantNames.get(order.restaurant_id) : undefined}
                    locked={locked}
                    fresh={freshIds.has(order.id)}
                    showStatus={filter === "all"}
                    onOpen={() => openDetail(order)}
                    onAdvance={
                      locked ? undefined : () => changeStatus(order.id, NEXT_STATUS[order.status]!)
                    }
                    onCancel={locked ? undefined : () => requestCancel(order)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Detalhes do pedido */}
      <OrderDetailDialog
        preview={detailPreview}
        order={detailOrder}
        loading={detailLoading}
        blocked={detailBlocked}
        error={detailError}
        storeName={
          (detailOrder ?? detailPreview)
            ? restaurantNames.get((detailOrder ?? detailPreview)!.restaurant_id)
            : undefined
        }
        onClose={closeDetail}
        onChangeStatus={changeStatus}
        onPrint={printOrder}
        onWhatsApp={contactWhatsApp}
      />

      {kitchenOpen && (
        <KitchenMode
          orders={displayedOrders}
          lockedStores={lockedStores}
          restaurantNames={restaurantNames}
          multi={multi}
          onAdvance={(order, status) => changeStatus(order.id, status)}
          onCancel={requestCancel}
          onClose={() => setKitchenOpen(false)}
        />
      )}
    </div>
  );
}

function OrderCard({
  order,
  storeName,
  locked = false,
  fresh = false,
  showStatus = true,
  onOpen,
  onAdvance,
  onCancel,
  compact = false,
}: {
  order: Order;
  storeName?: string;
  locked?: boolean;
  fresh?: boolean;
  /** Mostra o selo de status — redundante quando a aba já é o status. */
  showStatus?: boolean;
  onOpen: () => void;
  onAdvance?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const next = NEXT_STATUS[order.status];
  const nextLabel = next ? ORDER_STATUS_LABELS[next] : null;
  const items = order.order_items ?? [];
  return (
    <div
      className={cn(
        "card-lift group flex flex-col rounded-xl border p-2.5 transition-all",
        locked
          ? "border-amber-500/25 bg-amber-500/[0.04] hover:border-amber-500/40 hover:bg-amber-500/[0.07]"
          : "border-white/8 bg-white/[0.03] hover:border-cyan-500/30 hover:bg-white/[0.05]",
        fresh &&
          "animate-[slide-up_0.28s_ease-out_both] border-cyan-400/60 bg-cyan-500/[0.06] shadow-[0_0_0_1px_rgba(34,211,238,0.25)]",
      )}
    >
      <button onClick={onOpen} className="flex flex-1 flex-col gap-1.5 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            {fresh && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-cyan-500 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-black">
                Novo
              </span>
            )}
            <span className="truncate font-mono text-xs font-bold text-white">{order.comanda}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {locked && (
              <span className="grid size-4 place-items-center rounded-full bg-amber-500/15 text-amber-300">
                <Lock className="size-2.5" />
              </span>
            )}
            {showStatus && (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[9px] font-bold",
                  ORDER_STATUS_COLORS[order.status],
                )}
              >
                {ORDER_STATUS_LABELS[order.status]}
              </span>
            )}
          </span>
        </div>
        {storeName && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold text-gray-400">
            <Store className="size-2.5" /> {storeName}
          </span>
        )}
        <p className="truncate text-[11px] text-gray-400">{order.customer_name}</p>

        {/* Itens: visíveis normalmente; com a cota estourada, só esta linha é
            ocultada — número, cliente, horário, total e ações seguem à vista. */}
        {locked ? (
          <span className="flex items-center justify-between gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-200">
            <span className="flex items-center gap-1.5">
              <Lock className="size-3" /> Itens bloqueados
            </span>
            <span className="flex items-center gap-0.5 text-amber-300">
              Assinar <ArrowRight className="size-3" />
            </span>
          </span>
        ) : (
          items.length > 0 &&
          !compact && (
            <p className="line-clamp-2 text-[10px] leading-relaxed text-gray-500">
              {items
                .slice(0, 3)
                .map((i) => `${i.quantity}x ${i.product_name}`)
                .join(" • ")}
              {items.length > 3 ? ` • +${items.length - 3}` : ""}
            </p>
          )
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
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
  preview,
  order,
  loading,
  blocked,
  error,
  storeName,
  onClose,
  onChangeStatus,
  onPrint,
  onWhatsApp,
}: {
  preview: Order | null;
  order: Order | null;
  loading: boolean;
  blocked: boolean;
  error: string | null;
  storeName?: string;
  onClose: () => void;
  onChangeStatus: (id: string, status: OrderStatus) => void;
  onPrint: (o: Order) => void;
  onWhatsApp: (o: Order) => void;
}) {
  if (!preview && !order) return null;
  const headerRow = order ?? preview!;

  // Sem os detalhes liberados (carregando, bloqueado pelo plano ou erro), o
  // diálogo mostra só a identificação do pedido — nunca os dados comerciais.
  if (!order) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden border-white/10 bg-[#0f0f14] text-white sm:max-w-3xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <span className="font-mono text-lg">{headerRow.comanda}</span>
              <OrderStatusBadge status={headerRow.status} />
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              {storeName ? `${storeName} • ` : ""}
              {formatDate(headerRow.created_at)}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-1 items-center justify-center gap-2 py-10 text-sm text-gray-400">
              <RefreshCw className="size-4 animate-spin" /> Carregando detalhes…
            </div>
          ) : blocked ? (
            // Cota esgotada: o pedido continua visível (número, cliente, valor,
            // horário e ações). Só a lista de itens é substituída pelo convite.
            <div className="flex-1 space-y-4 overflow-y-auto">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                    Cliente
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{headerRow.customer_name}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{headerRow.customer_phone || "—"}</p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                    Total
                  </p>
                  <p className="mt-1 text-lg font-black text-cyan-400">{brl(headerRow.total)}</p>
                  <p className="mt-0.5 text-xs capitalize text-gray-400">
                    {headerRow.delivery_type === "entrega" ? "Entrega" : "Retirada"} •{" "}
                    {headerRow.payment_method}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
                    <Lock className="size-4" />
                  </span>
                  <p className="text-sm leading-relaxed text-amber-100">
                    <span className="flex items-center gap-1.5 font-bold text-amber-200">
                      <Sparkles className="size-4" /> Itens bloqueados
                    </span>
                    O limite do plano gratuito foi atingido, então a lista de itens fica oculta. O
                    pedido continua salvo e gerenciável.
                  </p>
                </div>
              </div>

              {/* O lugar dos itens é o convite para assinar — mesmo fluxo. */}
              <Link
                to="/admin/assinatura"
                className="tap flex items-center justify-between gap-3 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-500/20 to-cyan-500/5 px-4 py-3 transition-colors hover:border-cyan-400 hover:from-cyan-500/30"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-black text-white">Assinar Premium agora</span>
                  <span className="mt-0.5 block text-[11px] text-cyan-200/80">
                    Pedidos ilimitados e itens liberados na hora
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-cyan-500 px-3 py-1.5 text-[11px] font-black text-black">
                  {PREMIUM_PRICE_LABEL}
                </span>
              </Link>

              <p className="text-center text-[11px] leading-relaxed text-gray-500">
                Assim que o Premium for ativado, os itens aparecem automaticamente.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4 text-sm text-red-200">
              {error ?? "Não foi possível carregar os detalhes deste pedido."}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  const next = NEXT_STATUS[order.status];
  const hasCustomerPhone =
    Boolean(order.customer_phone) && order.customer_phone.replace(/\D/g, "").length >= 10;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden border-white/10 bg-[#0f0f14] text-white sm:max-w-3xl lg:max-w-4xl">
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

        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          <div className="grid gap-3 md:grid-cols-2">
            {/* Coluna esquerda: cliente e entrega */}
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
                        {[
                          order.customer_complement,
                          order.customer_neighborhood,
                          order.customer_city,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-white">Retirada no balcão</p>
                )}
              </div>
            </div>

            {/* Coluna direita: itens e pagamento */}
            <div className="space-y-3">
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
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-2 pt-1 md:col-span-2">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
