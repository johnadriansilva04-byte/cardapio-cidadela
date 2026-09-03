import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Store } from "lucide-react";
import {
  getRestaurantsByOwner,
  getOrCreateOwnerId,
} from "@/modules/supabase/restaurants";
import { SharePanel } from "@/components/admin/SharePanel";
import type { Restaurant } from "@/lib/types";

export const Route = createFileRoute("/admin/compartilhar")({
  head: () => ({ meta: [{ title: "Compartilhar — MenuFácil" }] }),
  component: CompartilharPage,
});

function CompartilharPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getRestaurantsByOwner(getOrCreateOwnerId());
      setRestaurants(data);
      if (data.length > 0) setSelectedId(data[0].id);
      setLoading(false);
    }
    load();
  }, []);

  const selected = restaurants.find((r) => r.id === selectedId);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
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
          Links, QR Code e WhatsApp
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
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

      {selected && <SharePanel restaurant={selected} />}
    </div>
  );
}
