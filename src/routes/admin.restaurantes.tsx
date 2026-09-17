import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Store, Plus, AlertCircle, RefreshCw, Search, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RestaurantCardCompact } from "@/components/admin/RestaurantCardCompact";
import { RestaurantDialog, type RestaurantFormValues } from "@/components/admin/RestaurantDialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  getRestaurantsByOwner,
  ensureRestaurantsForUser,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
} from "@/modules/supabase/restaurants";
import { supabase } from "@/modules/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { serializeHours } from "@/lib/operatingHours";
import type { Restaurant } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/restaurantes")({
  head: () => ({ meta: [{ title: "Restaurantes — Cardápio Cidadela" }] }),
  component: RestaurantesPage,
});

function RestaurantesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [deleting, setDeleting] = useState<Restaurant | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
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
        if (data.length > 0) retryRef.current = 0;
        else if (retryRef.current < 3) {
          retryRef.current++;
          await new Promise((r) => setTimeout(r, retryRef.current * 400));
          if (cancelled) return;
          const retry = await getRestaurantsByOwner(user!.id);
          if (!cancelled) setRestaurants(retry);
        }
      } catch (e) {
        console.error("[restaurantes] load", e);
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

  // Contagem de produtos por restaurante (dados reais)
  useEffect(() => {
    if (restaurants.length === 0) {
      setProductCounts({});
      return;
    }
    let cancelled = false;
    (async () => {
      const ids = restaurants.map((r) => r.id);
      const { data } = await supabase
        .from("products")
        .select("restaurant_id")
        .in("restaurant_id", ids);
      if (!cancelled && data) {
        const counts: Record<string, number> = {};
        for (const p of data) counts[p.restaurant_id] = (counts[p.restaurant_id] ?? 0) + 1;
        setProductCounts(counts);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurants]);

  const filtered = restaurants.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return r.name.toLowerCase().includes(s) || r.slug.toLowerCase().includes(s);
  });

  async function handleCreate(values: RestaurantFormValues): Promise<Restaurant | null> {
    if (!user) return null;
    setSubmitting(true);
    try {
      const { restaurant: created, error: createError } = await createRestaurant(user.id, {
        name: values.name,
        slug: values.slug,
        description: values.description,
        phone: values.phone,
        whatsapp: values.whatsapp,
        address: values.address,
        logo_url: values.logo_url,
        banner_url: values.banner_url,
        primary_color: values.primary_color,
        secondary_color: values.secondary_color,
        status: values.status,
        pix_key: values.pix_key,
        delivery_fee: parseFloat(values.delivery_fee.replace(",", ".")) || 0,
        operating_hours: serializeHours(values.operating_hours),
      });
      if (!created) {
        toast.error(createError ?? "Erro ao criar restaurante.");
        return null;
      }
      setRestaurants((prev) => [created, ...prev]);
      toast.success("Restaurante criado e configurado!");
      return created;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(values: RestaurantFormValues, patchId?: string) {
    if (!editing && !patchId) return;
    const targetId = patchId ?? editing!.id;
    setSubmitting(true);
    try {
      const ok = await updateRestaurant(targetId, {
        name: values.name,
        slug: values.slug,
        description: values.description,
        phone: values.phone,
        whatsapp: values.whatsapp,
        address: values.address,
        logo_url: values.logo_url,
        banner_url: values.banner_url,
        primary_color: values.primary_color,
        secondary_color: values.secondary_color,
        status: values.status,
        pix_key: values.pix_key,
        delivery_fee: parseFloat(values.delivery_fee.replace(",", ".")) || 0,
        operating_hours: serializeHours(values.operating_hours),
      });
      if (!ok) {
        toast.error("Erro ao salvar.");
        return;
      }
      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === targetId
            ? ({
                ...r,
                ...values,
                delivery_fee: parseFloat(values.delivery_fee.replace(",", ".")) || 0,
              } as Restaurant)
            : r,
        ),
      );
      setEditing(null);
      // A segunda passada (upload das imagens) é continuação do mesmo save:
      // evita um segundo toast logo depois do "criado".
      if (!patchId) toast.success("Restaurante atualizado!");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePublish(r: Restaurant) {
    setTogglingId(r.id);
    const next = r.status === "published" ? "paused" : "published";
    const ok = await updateRestaurant(r.id, { status: next });
    setTogglingId(null);
    if (!ok) {
      toast.error("Falha ao alterar status.");
      return;
    }
    setRestaurants((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
    toast.success(next === "published" ? "Publicado!" : "Despublicado (pausado).");
  }

  async function handleDelete() {
    if (!deleting) return;
    const ok = await deleteRestaurant(deleting.id);
    if (!ok) {
      toast.error("Erro ao excluir.");
      return;
    }
    setRestaurants((prev) => prev.filter((r) => r.id !== deleting.id));
    setDeleting(null);
    toast.success("Restaurante excluído.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Restaurantes</h1>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            Cada restaurante tem seu link público em /cardapio/seu-slug. Gerencie tudo por aqui.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="shrink-0 rounded-full bg-cyan-500 px-5 text-sm font-bold text-black hover:bg-cyan-400"
        >
          <Plus className="size-4" /> Novo restaurante
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-600" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou slug…"
            className="border-white/10 bg-white/[0.04] pl-9 text-white placeholder:text-gray-600"
          />
        </div>
        <span className="hidden text-xs text-gray-500 sm:inline">
          {filtered.length} de {restaurants.length}
        </span>
      </div>

      {error && (
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
      )}

      {!error &&
        (authLoading || loading ? (
          <div className="flex justify-center py-12">
            <div className="size-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] py-12 text-center">
            <Store className="mx-auto size-10 text-gray-700" />
            <p className="mt-3 text-sm font-semibold text-white">
              {restaurants.length === 0 ? "Nenhum restaurante ainda" : "Nenhum resultado"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {restaurants.length === 0
                ? 'Clique em "Novo restaurante" para começar.'
                : "Tente outro termo de busca."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((r) => (
              <RestaurantCardCompact
                key={r.id}
                restaurant={r}
                menuItemCount={productCounts[r.id] ?? null}
                onOpen={() =>
                  navigate({
                    to: "/admin/restaurante/$id",
                    params: { id: r.id },
                    search: { tab: undefined },
                  })
                }
                onEdit={() => {
                  setEditing(r);
                  setDialogOpen(true);
                }}
                onTogglePublish={() => handleTogglePublish(r)}
                onDelete={() => setDeleting(r)}
                onManageMenu={() =>
                  navigate({
                    to: "/admin/restaurante/$id",
                    params: { id: r.id },
                    search: { tab: "cardapio" },
                  })
                }
                onManageOrders={() =>
                  navigate({
                    to: "/admin/pedidos",
                    search: { store: r.id },
                  })
                }
                onSettings={() =>
                  navigate({
                    to: "/admin/restaurante/$id",
                    params: { id: r.id },
                    search: { tab: "config" },
                  })
                }
                toggling={togglingId === r.id}
              />
            ))}
          </div>
        ))}

      <RestaurantDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        restaurant={editing}
        submitting={submitting}
        onSubmit={async (values, isEdit, patchId) =>
          isEdit ? handleUpdate(values, patchId) : handleCreate(values)
        }
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir restaurante?"
        description={
          deleting
            ? `Isso apaga "${deleting.name}" e todo o cardápio e histórico vinculados. Não há desfazer.`
            : ""
        }
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  );
}
