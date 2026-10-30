import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { DashboardPanels } from "@/components/mobile/DashboardPanels";
import { EmptyState, InlineError, LoadingState } from "@/modules/ui/Feedback";
import { PageHeader } from "@/modules/ui/PageHeader";
import { PremiumUsageMeter } from "@/modules/ui/PremiumUsageMeter";
import { HeaderIconButton } from "@/modules/ui/Controls";
import { computeMetrics } from "@/modules/mobile/orders";
import { useMobileStore } from "@/modules/mobile/store-context";
import { checkSubscriptionStatus, MONTHLY_FREE_LIMIT } from "@/modules/supabase/subscription";
import { fetchRewards, type RewardProgress } from "@/modules/supabase/rewards";
import { RewardsProgress } from "@/modules/ui/RewardsProgress";
import { brl } from "@/lib/utils";

export const Route = createFileRoute("/mobile/dashboard")({
  head: () => ({
    meta: [
      { title: "Métricas — Gestão Mobile" },
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
  const [sub, setSub] = useState<{
    used: number;
    premium: boolean;
    bonus: number;
    dayActive: boolean;
    dayUntil: string | null;
    credits: number;
  } | null>(null);
  const [rewards, setRewards] = useState<RewardProgress[]>([]);

  const metrics = useMemo(() => computeMetrics(orders, restaurantNames), [orders, restaurantNames]);
  const primaryId = restaurants[0]?.id;

  // Estado do plano para o termômetro de uso (o mesmo do painel admin).
  useEffect(() => {
    if (!primaryId) {
      setSub(null);
      return;
    }
    let cancelled = false;
    checkSubscriptionStatus(primaryId)
      .then((s) => {
        if (!cancelled)
          setSub({
            used: s.monthlyOrderCount,
            premium: s.isPremium,
            bonus: s.bonusOrders,
            dayActive: s.dayPassActive,
            dayUntil: s.dayPassUntil,
            credits: s.dayPassCredits,
          });
      })
      .catch(() => {
        if (!cancelled) setSub(null);
      });
    fetchRewards(primaryId)
      .then((r) => {
        if (!cancelled) setRewards(r);
      })
      .catch(() => {
        if (!cancelled) setRewards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [primaryId]);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    if (primaryId) {
      try {
        const s = await checkSubscriptionStatus(primaryId);
        setSub({
          used: s.monthlyOrderCount,
          premium: s.isPremium,
          bonus: s.bonusOrders,
          dayActive: s.dayPassActive,
          dayUntil: s.dayPassUntil,
          credits: s.dayPassCredits,
        });
      } catch {
        /* termômetro é best-effort */
      }
    }
    setRefreshing(false);
  }

  if (loading) {
    return <LoadingState label="Carregando métricas…" className="h-full" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Métricas"
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

      {sub && (
        <PremiumUsageMeter
          used={sub.used}
          limit={MONTHLY_FREE_LIMIT}
          bonus={sub.bonus}
          isPremium={sub.premium}
          dayPassActive={sub.dayActive}
          dayPassUntil={sub.dayUntil}
          dayPassCredits={sub.credits}
        />
      )}

      {sub && !sub.premium && <RewardsProgress rewards={rewards} />}

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
