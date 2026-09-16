import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Package, RefreshCw, Search, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { OrderCard } from "@/components/mobile/OrderCard";
import { EmptyState, InlineError } from "@/modules/ui/Feedback";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { computeMetrics, isActive } from "@/modules/mobile/orders";
import {
  loadPreferences,
  savePreference,
  subscribePreferences,
} from "@/modules/mobile/preferences";
import { useOwnerOrders } from "@/modules/mobile/useOwnerOrders";
import { updateOrderStatus } from "@/modules/supabase/orders";
import { brl } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/mobile/")({
  head: () => ({
    meta: [
      { title: "Pedidos — Gestão Mobile" },
      {
        name: "description",
        content: "Acompanhe, avance e finalize os pedidos do seu restaurante em tempo real.",
      },
    ],
  }),
  component: MobileOrdersPage,
});

type FilterKey = "active" | "today" | "all";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "active", label: "Em andamento" },
  { key: "today", label: "Hoje" },
  { key: "all", label: "Todos" },
];

function startOfToday(): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Regra de cada aba, compartilhada entre a contagem do botão e a lista filtrada —
 * antes o número vinha das métricas e podia não bater com o que a lista mostrava
 * (pedido cancelado contava na aba "Hoje" mas não aparecia nela).
 */
function matchesFilter(order: Order, filter: FilterKey, todayStart: number): boolean {
  if (filter === "all") return true;
  if (filter === "active") return isActive(order.status);
  return new Date(order.created_at).getTime() >= todayStart || isActive(order.status);
}

function MobileOrdersPage() {
  const { user } = useAuth();
  const { restaurants, orders, loading, error, refresh, reloadOrders, restaurantNames } =
    useOwnerOrders(user?.id);

  const [filter, setFilter] = useState<FilterKey>("active");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [prefs, setPrefs] = useState(() => loadPreferences());

  useEffect(() => subscribePreferences(setPrefs), []);

  const metrics = useMemo(() => computeMetrics(orders, restaurantNames), [orders, restaurantNames]);

  const todayStart = useMemo(() => startOfToday(), []);

  const filterCounts = useMemo(
    () => ({
      active: orders.filter((order) => matchesFilter(order, "active", todayStart)).length,
      today: orders.filter((order) => matchesFilter(order, "today", todayStart)).length,
      all: orders.length,
    }),
    [orders, todayStart],
  );

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (!matchesFilter(order, filter, todayStart)) return false;
      if (!term) return true;
      return (
        order.customer_name.toLowerCase().includes(term) ||
        order.comanda.toLowerCase().includes(term) ||
        (order.customer_phone ?? "").includes(term)
      );
    });
  }, [orders, filter, search, todayStart]);

  const handleAdvance = useCallback(
    async (order: Order, status: OrderStatus) => {
      setBusyId(order.id);
      const ok = await updateOrderStatus(order.id, status);
      if (ok) {
        toast.success(`${order.comanda} → ${status === "delivered" ? "concluído" : "atualizado"}`);
        await reloadOrders();
      } else {
        toast.error("Não foi possível atualizar o pedido.");
      }
      setBusyId(null);
    },
    [reloadOrders],
  );

  const handleCancel = useCallback((order: Order) => {
    setCancelTarget(order);
  }, []);

  const confirmCancel = useCallback(async () => {
    const order = cancelTarget;
    if (!order) return;
    setBusyId(order.id);
    const ok = await updateOrderStatus(order.id, "cancelled");
    if (ok) {
      toast.success(`${order.comanda} cancelado.`);
      await reloadOrders();
    } else {
      toast.error("Não foi possível cancelar o pedido.");
    }
    setBusyId(null);
    setCancelTarget(null);
  }, [cancelTarget, reloadOrders]);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  function toggleSound() {
    const next = !prefs.sound;
    savePreference("sound", next);
    toast.success(next ? "Alerta sonoro ativado." : "Alerta sonoro desativado.");
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <RefreshCw className="size-7 animate-spin text-cyan-400" />
        <p className="mt-3 text-sm text-gray-400">Carregando pedidos…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Cabeçalho: números que o operador olha de relance */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Pedidos</h1>
          <p className="text-xs text-gray-400">
            {metrics.activeCount > 0
              ? `${metrics.activeCount} em andamento · ${brl(metrics.todayRevenue)} hoje`
              : `${metrics.todayOrders} hoje · ${brl(metrics.todayRevenue)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            aria-label={prefs.sound ? "Desativar alerta sonoro" : "Ativar alerta sonoro"}
            title={prefs.sound ? "Alerta sonoro ligado" : "Alerta sonoro desligado"}
            className={`grid size-10 place-items-center rounded-xl border transition-colors ${
              prefs.sound
                ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
                : "border-white/10 bg-white/5 text-gray-500"
            }`}
          >
            {prefs.sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Atualizar pedidos"
            className="grid size-10 place-items-center rounded-xl bg-white/5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <InlineError message={error} onRetry={handleRefresh} retrying={refreshing} />}

      {/* Busca + filtros */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cliente, telefone ou comanda"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          />
        </div>

        <div className="flex gap-2">
          {FILTERS.map((item) => {
            const count = filterCounts[item.key];
            const isActiveFilter = filter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-all ${
                  isActiveFilter
                    ? "bg-cyan-500 text-black"
                    : "border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {item.label}
                <span
                  className={`rounded-full px-1.5 text-[10px] ${
                    isActiveFilter ? "bg-black/20 text-black" : "bg-white/10 text-gray-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {visibleOrders.length === 0 ? (
          <EmptyState
            icon={search ? Search : Package}
            title={
              search
                ? "Nenhum pedido com esse termo"
                : filter === "active"
                  ? "Nenhum pedido em andamento"
                  : "Nenhum pedido por aqui"
            }
            description={
              search
                ? "Confira a grafia ou limpe a busca para ver todos os pedidos."
                : "Assim que um cliente enviar um pedido, ele aparece aqui com alerta sonoro."
            }
            action={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10"
                >
                  Limpar busca
                </button>
              ) : undefined
            }
          />
        ) : (
          visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              restaurant={restaurants.find((r) => r.id === order.restaurant_id)}
              showRestaurant={restaurants.length > 1}
              // Com "cards recolhidos" ligado, o operador abre o que precisa;
              // desligado, os pedidos em andamento já vêm com os itens à vista.
              defaultOpen={!prefs.compactCards && isActive(order.status)}
              busy={busyId === order.id}
              onAdvance={handleAdvance}
              onCancel={handleCancel}
            />
          ))
        )}
      </div>

      {/* Rodapé de contexto: totais do histórico */}
      {filter !== "active" && (metrics.finishedCount > 0 || metrics.cancelledCount > 0) && (
        <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <Package className="size-3" /> {metrics.finishedCount} entregues
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Ban className="size-3" /> {metrics.cancelledCount} cancelados
          </span>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancelar pedido?"
        description={`O pedido ${cancelTarget?.comanda ?? ""} de ${cancelTarget?.customer_name ?? ""} será marcado como cancelado. Essa ação não pode ser desfeita.`}
        confirmLabel="Cancelar pedido"
        cancelLabel="Voltar"
        loading={Boolean(cancelTarget) && busyId === cancelTarget?.id}
        onConfirm={confirmCancel}
      />
    </div>
  );
}

export default MobileOrdersPage;
