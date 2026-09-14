import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Store, ClipboardList, TrendingUp, Plus, ArrowRight, AlertCircle, RefreshCw, Wallet, Award, Ban, UtensilsCrossed, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RestaurantCardCompact } from "@/components/admin/RestaurantCardCompact";
import { RestaurantDialog, type RestaurantFormValues } from "@/components/admin/RestaurantDialog";
import { OrdersDonut } from "@/components/admin/OrdersDonut";
import { FinanceSummary } from "@/components/admin/FinanceSummary";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { getRestaurantsByOwner, ensureRestaurantsForUser, createRestaurant, updateRestaurant, deleteRestaurant } from "@/modules/supabase/restaurants";
import { supabase } from "@/modules/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import type { OrderStatus, Restaurant } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Cardápio Cidadela" }] }),
  component: AdminDashboardOverview,
});

type RangeKey = "7d" | "30d" | "90d" | "all";

function AdminDashboardOverview() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orders, setOrders] = useState<{ id: string; status: OrderStatus; total: number; created_at: string; restaurant_id: string }[]>([]);
  const [range, setRange] = useState<RangeKey>("30d");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [deleting, setDeleting] = useState<Restaurant | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
          setActiveId((prev) => prev || data[0].id);
        } else if (retryRef.current < 3) {
          retryRef.current++;
          await new Promise((r) => setTimeout(r, retryRef.current * 400));
          if (cancelled) return;
          const retry = await getRestaurantsByOwner(user!.id);
          if (!cancelled) {
            setRestaurants(retry);
            if (retry.length > 0) setActiveId((p) => p || retry[0].id);
          }
        }
      } catch (e) {
        console.error("[dashboard] load", e);
        if (!cancelled) setError("Falha ao carregar o dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // fetch orders for selected restaurant + range (real data)
  useEffect(() => {
    if (!activeId) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchOrders() {
      setOrdersLoading(true);
      try {
        let q = supabase.from("orders").select("id,status,total,created_at,restaurant_id").eq("restaurant_id", activeId).order("created_at", { ascending: false }).limit(800);
        // range filter
        if (range !== "all") {
          const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
          const since = new Date();
          since.setDate(since.getDate() - days);
          q = q.gte("created_at", since.toISOString());
        }
        const { data, error: err } = await q;
        if (cancelled) return;
        if (err) {
          console.error("[dashboard] orders", err);
          setOrders([]);
        } else {
          setOrders((data ?? []) as typeof orders);
        }
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    }
    fetchOrders();
    return () => {
      cancelled = true;
    };
  }, [activeId, range]);

  const counts = useMemo(() => {
    const init: Record<OrderStatus, number> = { received: 0, preparing: 0, ready: 0, out_for_delivery: 0, delivered: 0, cancelled: 0 };
    for (const o of orders) init[o.status] = (init[o.status] ?? 0) + 1;
    return init;
  }, [orders]);

  const financeMetrics = useMemo(() => {
    const totalOrders = orders.length;
    const cancelled = orders.filter((o) => o.status === "cancelled");
    const notCancelled = orders.filter((o) => o.status !== "cancelled");
    const totalRevenue = notCancelled.reduce((s, o) => s + Number(o.total || 0), 0);
    const cancelledRevenue = cancelled.reduce((s, o) => s + Number(o.total || 0), 0);
    const deliveredCount = counts.delivered;
    const averageTicket = notCancelled.length ? totalRevenue / notCancelled.length : 0;
    return {
      totalOrders,
      totalRevenue,
      cancelledRevenue,
      averageTicket,
      deliveredCount,
      cancelledCount: counts.cancelled,
      receivedCount: counts.received,
      preparingCount: counts.preparing,
    };
  }, [orders, counts]);

  const publishedCount = restaurants.filter((r) => r.status === "published").length;
  const draftCount = restaurants.filter((r) => r.status === "draft").length;

  async function handleCreate(values: RestaurantFormValues) {
    if (!user) return;
    setSubmitting(true);
    try {
      const r = await createRestaurant(user.id, values.name, values.slug, values.description);
      if (!r) {
        toast.error("Erro ao criar restaurante.");
        return;
      }
      // patch extra fields if provided
      const needsPatch =
        values.logo_url || values.banner_url || values.phone || values.whatsapp || values.address || values.pix_key || values.primary_color !== "#06b6d4";
      if (needsPatch) {
        await updateRestaurant(r.id, {
          logo_url: values.logo_url,
          banner_url: values.banner_url,
          phone: values.phone,
          whatsapp: values.whatsapp,
          address: values.address,
          pix_key: values.pix_key,
          primary_color: values.primary_color,
          secondary_color: values.secondary_color,
          status: values.status,
        });
        r.logo_url = values.logo_url;
        r.banner_url = values.banner_url;
        r.status = values.status;
      }
      setRestaurants((prev) => [r, ...prev]);
      setActiveId(r.id);
      setDialogOpen(false);
      toast.success("Restaurante criado!");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(values: RestaurantFormValues) {
    if (!editing) return;
    setSubmitting(true);
    try {
      const ok = await updateRestaurant(editing.id, {
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
      });
      if (!ok) {
        toast.error("Erro ao salvar.");
        return;
      }
      setRestaurants((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...values } : r)));
      setEditing(null);
      toast.success("Restaurante atualizado!");
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
    toast.success(next === "published" ? "Restaurante publicado!" : "Restaurante despublicado.");
  }

  async function handleDelete() {
    if (!deleting) return;
    const ok = await deleteRestaurant(deleting.id);
    if (!ok) {
      toast.error("Erro ao excluir.");
      return;
    }
    setRestaurants((prev) => prev.filter((r) => r.id !== deleting.id));
    if (activeId === deleting.id) setActiveId((prev) => (restaurants.find((r) => r.id !== prev)?.id ?? restaurants[0]?.id ?? ""));
    setDeleting(null);
    toast.success("Restaurante excluído.");
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
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

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Dashboard</h1>
          <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-gray-500">Visão geral do seu negócio — restaurantes, pedidos e faturamento calculados a partir dos pedidos registrados.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="shrink-0 rounded-full bg-cyan-500 px-5 text-sm font-bold text-black hover:bg-cyan-400">
          <Plus className="size-4" /> Criar restaurante
        </Button>
      </div>

      {/* KPI */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300">
              <Store className="size-4" />
            </div>
            <div>
              <p className="text-xl font-black text-white">{restaurants.length}</p>
              <p className="text-xs text-gray-500">Restaurantes</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <TrendingUp className="size-4" />
            </div>
            <div>
              <p className="text-xl font-black text-white">{publishedCount}</p>
              <p className="text-xs text-gray-500">Publicados</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
              <ClipboardList className="size-4" />
            </div>
            <div>
              <p className="text-xl font-black text-white">{orders.length}</p>
              <p className="text-xs text-gray-500">Pedidos no período</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
              <Wallet className="size-4" />
            </div>
            <div>
              <p className="text-xl font-black text-white">{financeMetrics.deliveredCount}</p>
              <p className="text-xs text-gray-500">Entregues</p>
            </div>
          </div>
        </div>
      </div>

      {/* selector + range when multiple */}
      {restaurants.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <span className="text-xs font-semibold text-gray-400">Restaurante</span>
          <Select value={activeId} onValueChange={setActiveId}>
            <SelectTrigger className="w-[220px] border-white/10 bg-white/[0.04] text-white">
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
          <span className="text-xs font-semibold text-gray-400">Período</span>
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="w-[150px] border-white/10 bg-white/[0.04] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#1a1a22] text-white">
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
          {restaurants.length === 1 && activeId && (
            <Link to="/admin/restaurantes" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
              Gerenciar <ArrowRight className="size-3" />
            </Link>
          )}
        </div>
      )}

      {restaurants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/5 text-gray-600">
            <UtensilsCrossed className="size-6" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-white">Nenhum restaurante ainda</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-gray-500">Crie seu primeiro restaurante para liberar cardápio, pedidos e financeiro.</p>
          <Button onClick={() => setDialogOpen(true)} className="mt-4 rounded-full bg-cyan-500 text-black hover:bg-cyan-400">
            <Plus className="size-4" /> Criar restaurante
          </Button>
        </div>
      ) : (
        <>
          {/* Seus restaurantes - grid compacto */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight text-white">Seus restaurantes</h2>
              <Link to="/admin/restaurantes" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                Ver todos <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {restaurants.map((r) => (
                <RestaurantCardCompact
                  key={r.id}
                  restaurant={r}
                  onEdit={() => {
                    setEditing(r);
                    setDialogOpen(true);
                  }}
                  onTogglePublish={() => handleTogglePublish(r)}
                  onDelete={() => setDeleting(r)}
                  onManageMenu={() => navigate({ to: "/admin/cardapio" })}
                  onManageOrders={() => navigate({ to: "/admin/pedidos" })}
                  onSettings={() => navigate({ to: "/admin/config" })}
                  toggling={togglingId === r.id}
                />
              ))}
            </div>
          </section>

          {/* Pedidos + Financeiro */}
          <section className="grid gap-4 lg:grid-cols-5">
            <div className="space-y-3 lg:col-span-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-tight text-white">Pedidos por status</h2>
                <Link to="/admin/pedidos" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                  Ver pedidos <ArrowRight className="size-3" />
                </Link>
              </div>
              {ordersLoading ? (
                <div className="flex h-[220px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02]">
                  <div className="size-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                </div>
              ) : (
                <OrdersDonut counts={counts} totalRevenue={financeMetrics.totalRevenue} totalOrders={financeMetrics.totalOrders} />
              )}
            </div>

            <div className="space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-tight text-white">Financeiro</h2>
                <Link to="/admin/financeiro" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                  Ver financeiro <ArrowRight className="size-3" />
                </Link>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <FinanceSummary
                  metrics={financeMetrics}
                  subtitle="Faturamento calculado pelos pedidos registrados (não é saldo bancário). Cancelados não entram no faturamento."
                />
              </div>
            </div>
          </section>
        </>
      )}

      <RestaurantDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        restaurant={editing}
        submitting={submitting}
        onSubmit={async (values, isEdit) => {
          if (isEdit) await handleUpdate(values);
          else await handleCreate(values);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir restaurante?"
        description={deleting ? `Isso apaga "${deleting.name}", suas categorias, produtos e histórico de pedidos associados. Não há desfazer.` : ""}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  );
}
