import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Store, AlertCircle, RefreshCw, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRestaurantsByOwner, ensureRestaurantsForUser, updateRestaurant } from "@/modules/supabase/restaurants";
import { MenuManager } from "@/components/admin/MenuManager";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { RestaurantStatusBadge } from "@/components/admin/StatusBadge";
import { useAuth } from "@/components/AuthProvider";
import type { Restaurant } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cardapio")({
  head: () => ({ meta: [{ title: "Cardápio — Cardápio Cidadela" }] }),
  component: CardapioPage,
});

function CardapioPage() {
  const { user, loading: authLoading } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishConfirm, setPublishConfirm] = useState<Restaurant | null>(null);
  const [toggling, setToggling] = useState(false);
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
  }, [user, authLoading]);

  useEffect(() => {
    if (!selectedId && restaurants.length > 0) setSelectedId(restaurants[0].id);
    if (selectedId && !restaurants.some((r) => r.id === selectedId) && restaurants.length > 0) setSelectedId(restaurants[0].id);
  }, [restaurants, selectedId]);

  const selected = restaurants.find((r) => r.id === selectedId) ?? restaurants[0] ?? null;

  async function togglePublish() {
    if (!publishConfirm) return;
    const next = publishConfirm.status === "published" ? "paused" : "published";
    setToggling(true);
    const ok = await updateRestaurant(publishConfirm.id, { status: next });
    setToggling(false);
    if (!ok) {
      toast.error("Falha ao alterar status.");
      return;
    }
    setRestaurants((prev) => prev.map((r) => (r.id === publishConfirm.id ? { ...r, status: next } : r)));
    toast.success(next === "published" ? "Cardápio publicado!" : "Cardápio despublicado.");
    setPublishConfirm(null);
  }

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
        <button onClick={() => window.location.reload()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400">
          <RefreshCw className="size-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
        <Store className="mx-auto size-12 text-gray-700" />
        <p className="mt-4 text-sm text-gray-400">Crie um restaurante primeiro para gerenciar cardápio</p>
      </div>
    );
  }

  const isPublished = selected?.status === "published";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Cardápio</h1>
          <p className="mt-1 text-sm text-gray-500">Categorias, produtos, fotos e preços — tudo ao vivo no link público.</p>
        </div>
        {selected && (
          <a href={`/cardapio/${selected.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/[0.08] hover:text-white">
            <ExternalLink className="size-3.5" /> Ver cardápio público
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {restaurants.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${selectedId === r.id ? "bg-cyan-500 text-black" : "border border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white"}`}
          >
            {r.name}
          </button>
        ))}
      </div>

      {selected && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <span className="text-xs font-semibold text-gray-400">Status do cardápio</span>
          <RestaurantStatusBadge status={selected.status} />
          <span className="text-xs text-gray-500">/cardapio/{selected.slug}</span>
          <Button
            size="sm"
            onClick={() => setPublishConfirm(selected)}
            className={`ml-auto rounded-full text-xs font-bold ${isPublished ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-emerald-500 text-white hover:bg-emerald-400"}`}
          >
            {isPublished ? (
              <>
                <EyeOff className="size-3.5" /> Despublicar
              </>
            ) : (
              <>
                <Eye className="size-3.5" /> Publicar
              </>
            )}
          </Button>
        </div>
      )}

      {selected && <MenuManager key={selected.id} restaurant={selected} />}

      <ConfirmDialog
        open={Boolean(publishConfirm)}
        onOpenChange={(o) => !o && setPublishConfirm(null)}
        title={publishConfirm?.status === "published" ? "Despublicar cardápio?" : "Publicar cardápio?"}
        description={
          publishConfirm?.status === "published"
            ? "Clientes verão “indisponível” ao abrir o link. Você pode republicar a qualquer momento."
            : "O cardápio ficará acessível publicamente em /cardapio/" + (publishConfirm?.slug ?? "")
        }
        confirmLabel={publishConfirm?.status === "published" ? "Despublicar" : "Publicar"}
        variant={publishConfirm?.status === "published" ? "destructive" : "default"}
        onConfirm={togglePublish}
        loading={toggling}
      />
    </div>
  );
}
