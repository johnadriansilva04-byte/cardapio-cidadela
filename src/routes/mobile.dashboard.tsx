import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { DashboardPanels } from "@/components/mobile/DashboardPanels";
import { EmptyState, InlineError, LoadingState } from "@/modules/ui/Feedback";
import { PageHeader } from "@/modules/ui/PageHeader";
import { HeaderIconButton } from "@/modules/ui/Controls";
import { computeMetrics } from "@/modules/mobile/orders";
import { useMobileStore } from "@/modules/mobile/store-context";
import { brl } from "@/lib/utils";

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

  const metrics = useMemo(() => computeMetrics(orders, restaurantNames), [orders, restaurantNames]);

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
        subtitle={
          metrics.totalOrders > 0
            ? `${metrics.totalOrders} pedido${metrics.totalOrders === 1 ? "" : "s"} na base · ticket ${brl(metrics.averageTicket)}`
            : "Visão rápida do negócio"
        }
        actions={
          <HeaderIconButton
            icon={RefreshCw}
            label="Atualizar painel"
            spinning={refreshing}
            disabled={refreshing}
            onClick={handleRefresh}
          />
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
