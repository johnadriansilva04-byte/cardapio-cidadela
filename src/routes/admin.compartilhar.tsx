import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Store, AlertCircle, RefreshCw } from "lucide-react";
import {
  getRestaurantsByOwner,
  ensureRestaurantsForUser,
} from "@/modules/supabase/restaurants";
import { SharePanel } from "@/components/admin/SharePanel";
import { useAuth } from "@/components/AuthProvider";
import type { Restaurant } from "@/lib/types";

export const Route = createFileRoute("/admin/compartilhar")({
  head: () => ({ meta: [{ title: "Compartilhar — Cardápio Cidadela" }] }),
  component: CompartilharPage,
});

function CompartilharPage() {
  const { user, loading: authLoading } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (data.length > 0) setSelectedId((prev) => prev || data[0].id);
      } catch (e) {
        console.error("[compartilhar] load error", e);
        if (!cancelled) setError("Falha ao carregar restaurantes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  useEffect(() => {
    if (!selectedId && restaurants.length > 0) setSelectedId(restaurants[0].id);
    if (selectedId && !restaurants.some((r) => r.id === selectedId) && restaurants.length > 0) {
      setSelectedId(restaurants[0].id);
    }
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
          Crie um restaurante primeiro para compartilhar
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Compartilhar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Link público, QR Code e WhatsApp — pronto para enviar ao cliente
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {restaurants.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              selectedId === r.id
                ? "bg-cyan-500 text-black"
                : "border border-white/10 text-gray-400 hover:text-white hover:border-white/20"
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      {selected && <SharePanel key={selected.id} restaurant={selected} />}
    </div>
  );
}
