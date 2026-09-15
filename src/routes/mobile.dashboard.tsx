import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { DashboardPanels } from "@/components/mobile/DashboardPanels";
import { EmptyState, InlineError } from "@/modules/ui/Feedback";
import { useOwnerOrders } from "@/modules/mobile/useOwnerOrders";

export const Route = createFileRoute("/mobile/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — Gestão Mobile" },
      {
        name: "description",
        content: "Faturamento, ticket médio e situação dos pedidos do seu restaurante.",
      },
    ],
  }),
  component: MobileDashboardPage,
});

function MobileDashboardPage() {
  const { user } = useAuth();
  const { restaurants, orders, loading, error, refresh, restaurantNames } = useOwnerOrders(
    user?.id,
  );
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <RefreshCw className="size-7 animate-spin text-cyan-400" />
        <p className="mt-3 text-sm text-gray-400">Carregando painel…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Painel</h1>
          <p className="text-xs text-gray-400">Visão rápida do negócio</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Atualizar painel"
          className="grid size-10 place-items-center rounded-xl bg-white/5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <InlineError message={error} onRetry={handleRefresh} retrying={refreshing} />}

      {orders.length === 0 && !error ? (
        <EmptyState
          icon={TrendingUp}
          title="Sem pedidos para analisar"
          description="Assim que os primeiros pedidos chegarem, aqui aparecem faturamento, ticket médio e situação da operação."
        />
      ) : (
        <DashboardPanels
          orders={orders}
          restaurants={restaurants}
          restaurantNames={restaurantNames}
        />
      )}
    </div>
  );
}

export default MobileDashboardPage;
