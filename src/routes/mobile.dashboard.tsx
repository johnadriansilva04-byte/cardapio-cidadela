import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { DashboardPanels } from "@/components/mobile/DashboardPanels";
import { EmptyState, InlineError, LoadingState } from "@/modules/ui/Feedback";
import { PageHeader } from "@/modules/ui/PageHeader";
import { useMobileStore } from "@/modules/mobile/store-context";

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
  const { restaurants, orders, loading, error, refresh, restaurantNames } = useMobileStore();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  if (loading) {
    return <LoadingState label="Carregando painel…" className="h-full" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Painel"
        subtitle="Visão rápida do negócio"
        actions={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Atualizar painel"
            className="grid size-10 place-items-center rounded-xl bg-white/5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        }
      />

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
