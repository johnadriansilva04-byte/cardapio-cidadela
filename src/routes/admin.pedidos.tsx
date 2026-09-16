import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardList, Loader2, Store } from "lucide-react";
import { OrderManager } from "@/components/admin/OrderManager";
import { getRestaurantsByOwner, ensureRestaurantsForUser } from "@/modules/supabase/restaurants";
import { useAuth } from "@/components/AuthProvider";
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
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="text-sm text-red-300">{error}</p>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-400">
          <ClipboardList className="size-6" />
        </span>
        <h2 className="mt-4 text-sm font-bold text-white">Nenhum restaurante ainda</h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Os pedidos aparecem aqui assim que você tiver um restaurante publicado recebendo pedidos.
        </p>
        <Link
          to="/admin/restaurantes"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-xs font-bold text-black transition-colors hover:bg-cyan-400"
        >
          <Store className="size-3.5" /> Criar restaurante
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-black tracking-tight text-white">Pedidos</h1>
          <p className="text-xs text-gray-500">
            {restaurants.length === 1
              ? restaurants[0].name
              : `Todos os ${restaurants.length} restaurantes`}{" "}
            • atualização em tempo real
          </p>
        </div>
      </header>

      <OrderManager
        restaurants={restaurants}
        initialStoreId={store && restaurants.some((r) => r.id === store) ? store : undefined}
      />
    </div>
  );
}
