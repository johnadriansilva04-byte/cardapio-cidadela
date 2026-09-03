import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Store,
  Plus,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import {
  getRestaurantsByOwner,
  createRestaurant,
  generateUniqueSlug,
} from "@/modules/supabase/restaurants";
import { useAuth } from "@/components/AuthProvider";
import type { Restaurant } from "@/lib/types";

export const Route = createFileRoute("/admin/restaurantes")({
  head: () => ({ meta: [{ title: "Restaurantes — MenuFácil" }] }),
  component: RestaurantesPage,
});

function RestaurantesPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [slugPreview, setSlugPreview] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const { user } = useAuth();
  const ownerId = user?.id || "";

  useEffect(() => {
    if (!user) return;
    loadRestaurants();
  }, [user]);

  async function loadRestaurants() {
    setLoading(true);
    const data = await getRestaurantsByOwner(ownerId);
    setRestaurants(data);
    setLoading(false);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    const slug = await generateUniqueSlug(newName);
    const r = await createRestaurant(ownerId, newName, slug);
    setCreating(false);

    if (!r) {
      setMessage("Erro ao criar restaurante");
      return;
    }

    setMessage("Restaurante criado!");
    setNewName("");
    setSlugPreview("");
    setShowCreate(false);
    await loadRestaurants();
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/r/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Restaurantes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie seus restaurantes cadastrados
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
        >
          <Plus className="size-4" /> Novo restaurante
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
          {message}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="mb-4 text-base font-semibold text-white">
            Criar novo restaurante
          </h3>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">
                Nome do restaurante
              </label>
              <input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  const slug = e.target.value
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .replace(/\s+/g, "-")
                    .replace(/-+/g, "-")
                    .replace(/^-|-$/g, "");
                  setSlugPreview(slug);
                }}
                placeholder="Ex: Pizzaria do Mario"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
              />
            </div>

            {slugPreview && (
              <div className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                  URL do cardápio
                </p>
                <p className="mt-1 text-sm text-cyan-400 font-mono">
                  {window.location.origin}/r/{slugPreview}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="rounded-lg bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-cyan-400 disabled:opacity-40"
              >
                {creating ? "Criando..." : "Criar restaurante"}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                  setSlugPreview("");
                }}
                className="rounded-lg border border-white/10 px-6 py-2.5 text-sm text-gray-400 hover:text-white hover:border-white/20 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restaurant list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="size-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        </div>
      ) : restaurants.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
          <Store className="mx-auto size-12 text-gray-700" />
          <p className="mt-4 text-sm text-gray-400">
            Nenhum restaurante criado ainda
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Clique em "Novo restaurante" para começar
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {restaurants.map((r) => (
            <div
              key={r.id}
              className="group rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-white/10"
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: r.primary_color + "18" }}
                >
                  {r.logo_url ? (
                    <img
                      src={r.logo_url}
                      alt={r.name}
                      className="size-12 rounded-xl object-cover"
                    />
                  ) : (
                    <Store className="size-5 text-cyan-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-white">{r.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500 font-mono">
                    /r/{r.slug}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
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

                  <button
                    onClick={() => copyLink(r.slug)}
                    className="rounded-lg border border-white/10 p-2 text-gray-500 transition-colors hover:border-cyan-500/30 hover:text-cyan-400"
                    title="Copiar link"
                  >
                    {copied === r.slug ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>

                  <a
                    href={`/r/${r.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-white/10 p-2 text-gray-500 transition-colors hover:border-cyan-500/30 hover:text-cyan-400"
                    title="Abrir cardápio"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
