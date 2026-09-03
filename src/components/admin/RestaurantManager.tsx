import { useState } from "react";
import { updateRestaurant, generateUniqueSlug } from "@/modules/supabase/restaurants";
import type { Restaurant } from "@/lib/types";
import { brl } from "@/lib/utils";

const field =
  "w-full rounded-lg border border-cyan-500/30 bg-black/60 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500 focus:outline-none transition-colors";

export function RestaurantManager({
  restaurant,
  onUpdate,
}: {
  restaurant: Restaurant;
  onUpdate: (r: Restaurant) => void;
}) {
  const [name, setName] = useState(restaurant.name);
  const [description, setDescription] = useState(restaurant.description);
  const [slug, setSlug] = useState(restaurant.slug);
  const [logoUrl, setLogoUrl] = useState(restaurant.logo_url);
  const [bannerUrl, setBannerUrl] = useState(restaurant.banner_url);
  const [primaryColor, setPrimaryColor] = useState(restaurant.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(
    restaurant.secondary_color,
  );
  const [status, setStatus] = useState(restaurant.status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);

    // Check if slug needs to be regenerated
    let finalSlug = slug;
    if (name !== restaurant.name && slug === restaurant.slug) {
      finalSlug = await generateUniqueSlug(name, restaurant.id);
      setSlug(finalSlug);
    }

    const ok = await updateRestaurant(restaurant.id, {
      name,
      description,
      slug: finalSlug,
      logo_url: logoUrl,
      banner_url: bannerUrl,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      status,
    });

    setSaving(false);
    if (ok) {
      onUpdate({
        ...restaurant,
        name,
        description,
        slug: finalSlug,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        status,
      });
      setMessage("Restaurante atualizado!");
    } else {
      setMessage("Erro ao salvar");
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-white">Dados do restaurante</h3>

      <input
        className={field}
        placeholder="Nome do restaurante"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div>
        <label className="mb-1 block text-[10px] text-gray-500">
          Identificador (slug)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">/r/</span>
          <input
            className={field + " flex-1"}
            value={slug}
            onChange={(e) =>
              setSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, ""),
              )
            }
          />
        </div>
        <p className="mt-1 text-[10px] text-cyan-400">
          {typeof window !== "undefined"
            ? `${window.location.origin}/r/${slug}`
            : `/r/${slug}`}
        </p>
      </div>

      <textarea
        className={field}
        rows={2}
        placeholder="Descrição (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {/* Status */}
      <div>
        <label className="mb-1 block text-[10px] text-gray-500">
          Status do cardápio
        </label>
        <div className="flex gap-2">
          {(["draft", "published", "paused"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                status === s
                  ? s === "published"
                    ? "border-green-500 bg-green-500/20 text-green-300"
                    : s === "paused"
                      ? "border-yellow-500 bg-yellow-500/20 text-yellow-300"
                      : "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                  : "border-gray-700 bg-black/50 text-gray-500"
              }`}
            >
              {s === "draft"
                ? "Rascunho"
                : s === "published"
                  ? "Publicado"
                  : "Pausado"}
            </button>
          ))}
        </div>
      </div>

      {/* Appearance */}
      <h3 className="pt-2 text-sm font-bold text-white">Aparência</h3>

      <input
        className={field}
        placeholder="URL do logo"
        value={logoUrl}
        onChange={(e) => setLogoUrl(e.target.value)}
      />
      <input
        className={field}
        placeholder="URL do banner"
        value={bannerUrl}
        onChange={(e) => setBannerUrl(e.target.value)}
      />

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[10px] text-gray-500">
            Cor principal
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="size-10 rounded border-0 bg-transparent"
            />
            <input
              className={field + " flex-1"}
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[10px] text-gray-500">
            Cor secundária
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="size-10 rounded border-0 bg-transparent"
            />
            <input
              className={field + " flex-1"}
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      {logoUrl && (
        <div className="rounded-lg border border-cyan-500/20 p-3">
          <p className="mb-2 text-[10px] text-gray-500">Preview do logo:</p>
          <img
            src={logoUrl}
            alt="Logo preview"
            className="size-16 rounded-full object-cover"
          />
        </div>
      )}

      {message && <p className="text-xs text-cyan-300">{message}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-lg bg-cyan-600 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar dados"}
      </button>
    </div>
  );
}
