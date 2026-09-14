import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  UtensilsCrossed,
  ClipboardList,
  Settings2,
  Eye,
  EyeOff,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Store,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RestaurantDialog, type RestaurantFormValues } from "@/components/admin/RestaurantDialog";
import { MenuManager } from "@/components/admin/MenuManager";
import { OrderManager } from "@/components/admin/OrderManager";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { RestaurantStatusBadge } from "@/components/admin/StatusBadge";
import {
  getRestaurantsByOwner,
  ensureRestaurantsForUser,
  updateRestaurant,
} from "@/modules/supabase/restaurants";
import { useAuth } from "@/components/AuthProvider";
import type { Restaurant } from "@/lib/types";
import { brl } from "@/lib/utils";
import { toast } from "sonner";

const validTabs = ["cardapio", "pedidos", "config"] as const;

export const Route = createFileRoute("/admin/restaurante/$id")({
  validateSearch: (search: Record<string, unknown>) => {
    const tab = validTabs.includes(search.tab as (typeof validTabs)[number])
      ? (search.tab as (typeof validTabs)[number])
      : undefined;
    return { tab };
  },
  head: ({ params }) => ({
    meta: [{ title: `Gestão — Cardápio Cidadela` }],
  }),
  component: RestaurantDetailPage,
});

function RestaurantDetailPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [tab, setTab] = useState<string>(search.tab ?? "cardapio");
  const retryRef = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
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
        const found = data.find((r) => r.id === id) ?? null;
        setRestaurant(found);
        if (!found && data.length > 0 && retryRef.current < 3) {
          retryRef.current++;
          await new Promise((r) => setTimeout(r, retryRef.current * 400));
          if (cancelled) return;
          const again = await getRestaurantsByOwner(user!.id);
          if (!cancelled) {
            setRestaurants(again);
            setRestaurant(again.find((r) => r.id === id) ?? null);
            return;
          }
        }
      } catch (e) {
        console.error("[gestao] load", e);
        if (!cancelled) setError("Falha ao carregar o restaurante.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, user, authLoading]);

  async function handleSave(values: RestaurantFormValues) {
    if (!restaurant) return;
    setEditing(true);
    try {
      const ok = await updateRestaurant(restaurant.id, {
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
        delivery_radius_km: parseFloat(values.delivery_radius_km.replace(",", ".")) || 0,
      });
      if (!ok) {
        toast.error("Erro ao salvar.");
        return;
      }
      setRestaurant((prev) =>
        prev
          ? {
              ...prev,
              ...values,
              delivery_fee: parseFloat(values.delivery_fee.replace(",", ".")) || 0,
              delivery_radius_km: parseFloat(values.delivery_radius_km.replace(",", ".")) || 0,
            }
          : prev,
      );
      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === restaurant.id
            ? {
                ...r,
                ...values,
                delivery_fee: parseFloat(values.delivery_fee.replace(",", ".")) || 0,
                delivery_radius_km: parseFloat(values.delivery_radius_km.replace(",", ".")) || 0,
              }
            : r,
        ),
      );
      setEditOpen(false);
      toast.success("Restaurante atualizado!");
    } finally {
      setEditing(false);
    }
  }

  async function togglePublish() {
    if (!restaurant) return;
    const next = restaurant.status === "published" ? "paused" : "published";
    setToggling(true);
    const ok = await updateRestaurant(restaurant.id, { status: next });
    setToggling(false);
    if (!ok) {
      toast.error("Falha ao alterar status.");
      return;
    }
    setRestaurant((prev) => (prev ? { ...prev, status: next } : prev));
    setRestaurants((prev) =>
      prev.map((r) => (r.id === restaurant.id ? { ...r, status: next } : r)),
    );
    toast.success(next === "published" ? "Publicado!" : "Despublicado.");
    setPublishConfirm(false);
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="size-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

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

  if (!restaurant) {
    return (
      <div className="space-y-4 py-10 text-center">
        <Store className="mx-auto size-10 text-gray-700" />
        <p className="text-sm text-gray-400">Restaurante não encontrado ou você não tem acesso.</p>
        <Link
          to="/admin/restaurantes"
          className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300"
        >
          <ArrowLeft className="size-4" /> Voltar para Restaurantes
        </Link>
      </div>
    );
  }

  const isPublished = restaurant.status === "published";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            to="/admin/restaurantes"
            className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Voltar para restaurantes"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">{restaurant.name}</h1>
              <RestaurantStatusBadge status={restaurant.status} />
            </div>
            <p className="mt-1 font-mono text-xs text-gray-500">/cardapio/{restaurant.slug}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditOpen(true)}
            className="rounded-full border-white/10 bg-white/[0.04] text-xs font-semibold text-gray-300 hover:bg-white/[0.08] hover:text-white"
          >
            <Settings2 className="size-3.5" /> Editar dados
          </Button>
          <Button
            size="sm"
            onClick={() => setPublishConfirm(true)}
            disabled={toggling}
            className={`rounded-full text-xs font-bold ${isPublished ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-emerald-500 text-white hover:bg-emerald-400"}`}
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
          <a
            href={`/cardapio/${restaurant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-gray-300 hover:bg-white/[0.08] hover:text-white"
          >
            <ExternalLink className="size-3.5" /> Ver público
          </a>
        </div>
      </div>

      {/* Restaurants para trocar rápido */}
      {restaurants.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="w-full text-[10px] font-semibold uppercase tracking-widest text-gray-600">
            Trocar restaurante
          </span>
          <div className="flex flex-wrap gap-1.5">
            {restaurants.map((r) => (
              <Link
                key={r.id}
                to="/admin/restaurante/$id"
                params={{ id: r.id }}
                search={{ tab: undefined }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  r.id === restaurant.id
                    ? "bg-cyan-500 text-black"
                    : "border border-white/10 text-gray-400 hover:border-white/25 hover:text-white"
                }`}
              >
                {r.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="border-white/10 bg-white/[0.03]">
          <TabsTrigger
            value="cardapio"
            className="gap-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-black"
          >
            <UtensilsCrossed className="size-3.5" /> Cardápio
          </TabsTrigger>
          <TabsTrigger
            value="pedidos"
            className="gap-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-black"
          >
            <ClipboardList className="size-3.5" /> Pedidos
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="gap-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-black"
          >
            <Settings2 className="size-3.5" /> Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cardapio" className="mt-4">
          <MenuManager key={restaurant.id} restaurant={restaurant} />
        </TabsContent>
        <TabsContent value="pedidos" className="mt-4">
          <OrderManager key={restaurant.id} restaurant={restaurant} />
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          <div className="max-w-xl">
            <RestaurantCardSummary restaurant={restaurant} onEdit={() => setEditOpen(true)} />
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={publishConfirm}
        onOpenChange={setPublishConfirm}
        title={isPublished ? "Despublicar?" : "Publicar?"}
        description={
          isPublished
            ? "O link público deixará de aceitar novos pedidos e mostrará o cardápio como indisponível."
            : "O cardápio ficará acessível publicamente em /cardapio/" + restaurant.slug + "."
        }
        confirmLabel={isPublished ? "Despublicar" : "Publicar"}
        variant={isPublished ? "destructive" : "default"}
        onConfirm={togglePublish}
        loading={toggling}
      />

      <RestaurantDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        restaurant={restaurant}
        submitting={editing}
        onSubmit={handleSave}
      />
    </div>
  );
}

function RestaurantCardSummary({
  restaurant,
  onEdit,
}: {
  restaurant: Restaurant;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start gap-3">
        {restaurant.logo_url ? (
          <img
            src={restaurant.logo_url}
            alt={restaurant.name}
            className="size-12 rounded-xl object-cover"
          />
        ) : (
          <div className="grid size-12 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300">
            <Store className="size-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-white">{restaurant.name}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {restaurant.description || "Sem descrição"}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            {restaurant.phone ? `Telefone: ${restaurant.phone} • ` : ""}
            {restaurant.whatsapp ? `WhatsApp: ${restaurant.whatsapp} • ` : ""}
            {restaurant.address || "Sem endereço"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onEdit}
          className="rounded-full border-white/10 bg-white/[0.04] text-xs text-gray-300 hover:bg-white/[0.08]"
        >
          <Settings2 className="size-3.5" /> Editar
        </Button>
      </div>
      <div className="mt-4 grid gap-2 border-t border-white/5 pt-4 text-xs text-gray-500 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Settings2 className="size-3.5 text-gray-600" /> Status:{" "}
          <RestaurantStatusBadge status={restaurant.status} />
        </div>
        <div className="truncate">PIX: {restaurant.pix_key || "—"}</div>
        <div className="truncate">Taxa de entrega: {brl(restaurant.delivery_fee ?? 0)}</div>
        <div className="truncate">
          Raio de entrega:{" "}
          {restaurant.delivery_radius_km ? `${restaurant.delivery_radius_km} km` : "—"}
        </div>
      </div>
    </div>
  );
}
