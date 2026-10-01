import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardList, Store } from "lucide-react";
import { OrderManager } from "@/components/admin/OrderManager";
import { getRestaurantsByOwner, ensureRestaurantsForUser } from "@/modules/supabase/restaurants";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/modules/ui/PageHeader";
import { EmptyState, InlineError, LoadingState } from "@/modules/ui/Feedback";
import type { Restaurant } from "@/lib/types";

export const Route = createFileRoute("/admin/pedidos")({
  validateSearch: (search: Record<string, unknown>) => ({
    store: typeof search.store === "string" && search.store ? search.store : undefined,
  }),
  head: () => ({ meta: [{ title: "Pedidos — Cardápio Cidadela" }] }),
  component: PedidosPage,
});

function PedidosPage() {
  const { user, loading: authLoading } = useAuth();
  const { store } = Route.useSearch();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await ensureRestaurantsForUser(user);
        if (cancelled) return;
        const data = await getRestaurantsByOwner(user.id);
        if (!cancelled) setRestaurants(data);
      } catch (e) {
        console.error("[pedidos] load", e);
        if (!cancelled) setError("Falha ao carregar seus restaurantes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading || loading) {
    return <LoadingState label="Carregando pedidos…" />;
  }

  if (error) {
    return <InlineError message={error} onRetry={() => window.location.reload()} />;
  }

  if (restaurants.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nenhum restaurante ainda"
        description="Os pedidos aparecem aqui assim que você tiver um restaurante publicado recebendo pedidos."
        action={
          <Link
            to="/admin/restaurantes"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-xs font-bold text-black transition-colors hover:bg-cyan-400"
          >
            <Store className="size-3.5" /> Criar restaurante
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pedidos"
        subtitle={`${
          restaurants.length === 1
            ? restaurants[0].name
            : `Todos os ${restaurants.length} restaurantes`
        } • atualização em tempo real`}
      />

      <OrderManager
        restaurants={restaurants}
        initialStoreId={store && restaurants.some((r) => r.id === store) ? store : undefined}
      />
    </div>
  );
}
