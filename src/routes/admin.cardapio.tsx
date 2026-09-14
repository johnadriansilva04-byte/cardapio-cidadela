import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Store, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getRestaurantsByOwner, ensureRestaurantsForUser } from "@/modules/supabase/restaurants";
import { MenuManager } from "@/components/admin/MenuManager";
import { useAuth } from "@/components/AuthProvider";
import type { Restaurant } from "@/lib/types";

export const Route = createFileRoute("/admin/cardapio")({
  validateSearch: (search: Record<string, unknown>) => ({
    restaurantId: typeof search.restaurantId === "string" ? search.restaurantId : undefined,
  }),
  head: () => ({ meta: [{ title: "Cardápio — Cardápio Cidadela" }] }),
  component: CardapioPage,
});

function CardapioPage() {
  const { user, loading: authLoading } = useAuth();
  const search = Route.useSearch();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setRestaurants([]);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        await ensureRestaurantsForUser(user!);
        if (cancelled) return;
        const data = await getRestaurantsByOwner(user!.id);
        if (cancelled) return;
        setRestaurants(data);
        if (data.length > 0) {
          retryRef.current = 0;
          const want =
            search.restaurantId && data.some((r) => r.id === search.restaurantId)
              ? search.restaurantId
              : null;
          setSelectedId((prev) => prev || want || data[0].id);
        } else if (retryRef.current < 3) {
          retryRef.current++;
          await new Promise((r) => setTimeout(r, retryRef.current * 400));
          if (cancelled) return;
          const retry = await getRestaurantsByOwner(user!.id);
          if (!cancelled) {
            setRestaurants(retry);
            if (retry.length > 0) setSelectedId((prev) => prev || retry[0].id);
          }
        }
      } catch (e) {
        console.error("[cardapio admin] load", e);
        if (!cancelled) setError("Falha ao carregar restaurantes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, search.restaurantId]);

  useEffect(() => {
    if (!selectedId && restaurants.length > 0) setSelectedId(restaurants[0].id);
    if (selectedId && !restaurants.some((r) => r.id === selectedId) && restaurants.length > 0)
      setSelectedId(restaurants[0].id);
  }, [restaurants, selectedId]);

  const selected = restaurants.find((r) => r.id === selectedId) ?? restaurants[0] ?? null;

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertCircle className="mx-auto size-8 text-red-400" />
        <p className="mt-3 text-sm text-red-300">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400"
        >
          <RefreshCw className="size-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
        <Store className="mx-auto size-12 text-gray-700" />
        <p className="mt-4 text-sm text-gray-400">
          Crie um restaurante primeiro para gerenciar cardápio
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Cardápio</h1>
          <p className="mt-1 text-sm text-gray-500">
            Categorias, produtos, fotos e preços — tudo ao vivo no link público.
          </p>
        </div>
        {selected && (
          <a
            href={`/cardapio/${selected.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/[0.08] hover:text-white"
          >
            <ExternalLink className="size-3.5" /> Ver cardápio público
          </a>
        )}
      </div>

      {/* Seletor de restaurante */}
      {restaurants.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl bg-white/[0.03] px-2.5 py-1.5">
            <Store className="size-3.5 text-gray-500" />
            <span className="text-[11px] font-semibold text-gray-400">Restaurante</span>
          </div>
          <Select value={selectedId} onValueChange={(v) => setSelectedId(v)}>
            <SelectTrigger className="h-9 w-full min-w-[240px] border-white/10 bg-white/[0.04] text-sm text-white sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#1a1a22] text-white">
              {restaurants.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selected && <MenuManager key={selected.id} restaurant={selected} />}
    </div>
  );
}
