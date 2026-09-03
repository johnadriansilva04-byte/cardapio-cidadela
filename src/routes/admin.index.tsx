import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Store,
  ClipboardList,
  TrendingUp,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  getRestaurantsByOwner,
  getOrCreateOwnerId,
} from "@/modules/supabase/restaurants";
import type { Restaurant } from "@/lib/types";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — MenuFácil" }] }),
  component: AdminDashboardOverview,
});

function AdminDashboardOverview() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const ownerId = getOrCreateOwnerId();
      const data = await getRestaurantsByOwner(ownerId);
      setRestaurants(data);
      setLoading(false);
    }
    load();
  }, []);

  const publishedCount = restaurants.filter((r) => r.status === "published").length;
  const draftCount = restaurants.filter((r) => r.status === "draft").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Visão geral dos seus restaurantes
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-500/10">
              <Store className="size-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{restaurants.length}</p>
              <p className="text-xs text-gray-500">Restaurantes</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10">
              <TrendingUp className="size-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{publishedCount}</p>
              <p className="text-xs text-gray-500">Publicados</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-yellow-500/10">
              <ClipboardList className="size-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{draftCount}</p>
              <p className="text-xs text-gray-500">Rascunhos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick create */}
      <Link
        to="/admin/restaurantes"
        className="group flex items-center gap-4 rounded-xl border border-dashed border-cyan-500/20 bg-cyan-500/[0.03] p-6 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/[0.06]"
      >
        <div className="flex size-12 items-center justify-center rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
          <Plus className="size-6 text-cyan-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">
            Criar novo restaurante
          </p>
          <p className="text-xs text-gray-500">
            Adicione um novo restaurante à plataforma
          </p>
        </div>
        <ArrowRight className="size-5 text-gray-600 group-hover:text-cyan-400 transition-colors" />
      </Link>

      {/* Recent restaurants */}
      {restaurants.length > 0 && (
        <div>
          <h2 className="mb-4 text-sm font-semibold text-gray-300">
            Seus restaurantes
          </h2>
          <div className="space-y-3">
            {restaurants.slice(0, 5).map((r) => (
              <Link
                key={r.id}
                to="/admin/restaurantes"
                className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-white/10"
              >
                <div
                  className="flex size-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: r.primary_color + "22" }}
                >
                  {r.logo_url ? (
                    <img
                      src={r.logo_url}
                      alt={r.name}
                      className="size-10 rounded-lg object-cover"
                    />
                  ) : (
                    <Store className="size-5 text-cyan-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {r.name}
                  </p>
                  <p className="text-[11px] text-gray-500">/{r.slug}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    r.status === "published"
                      ? "bg-green-500/15 text-green-400"
                      : r.status === "paused"
                        ? "bg-yellow-500/15 text-yellow-400"
                        : "bg-gray-500/15 text-gray-400"
                  }`}
                >
                  {r.status === "published"
                    ? "PUBLICADO"
                    : r.status === "paused"
                      ? "PAUSADO"
                      : "RASCUNHO"}
                </span>
                <ArrowRight className="size-4 shrink-0 text-gray-600" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
