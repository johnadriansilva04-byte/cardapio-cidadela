import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Store, AlertCircle, RefreshCw } from "lucide-react";
import { getRestaurantsByOwner, ensureRestaurantsForUser } from "@/modules/supabase/restaurants";
import { SharePanel } from "@/components/admin/SharePanel";
import { PageHeader } from "@/modules/ui/PageHeader";
import { EmptyState, LoadingState } from "@/modules/ui/Feedback";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
          setSelectedId((prev) => prev || data[0].id);
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
    return <LoadingState label="Carregando…" />;
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
      <EmptyState
        icon={Store}
        title="Crie um restaurante primeiro"
        description="O link público, o QR Code e o compartilhamento por WhatsApp aparecem aqui assim que houver uma loja."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compartilhar"
        subtitle="Link público, QR Code e WhatsApp — pronto para enviar ao cliente"
      />

      <div className="max-w-xs">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="border-white/10 bg-white/[0.04] text-sm text-white">
            <SelectValue placeholder="Escolha o restaurante" />
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

      {selected && <SharePanel key={selected.id} restaurant={selected} />}
    </div>
  );
}
