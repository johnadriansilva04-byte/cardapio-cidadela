import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Store } from "lucide-react";
import {
  getRestaurantsByOwner,
  ensureRestaurantsForUser,
  updateRestaurant,
} from "@/modules/supabase/restaurants";
import { useAuth } from "@/components/AuthProvider";
import type { Restaurant } from "@/lib/types";

export const Route = createFileRoute("/admin/config")({
  head: () => ({ meta: [{ title: "Configurações — MenuFácil" }] }),
  component: ConfigPage,
});

const field =
  "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30";

function ConfigPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    async function load() {
      await ensureRestaurantsForUser(user!);
      const data = await getRestaurantsByOwner(user!.id);
      setRestaurants(data);
      if (data.length > 0) {
        setSelectedId(data[0].id);
        fillFields(data[0]);
      }
      setLoading(false);
    }
    load();
  }, [user]);

  function fillFields(r: Restaurant) {
    setWhatsapp(r.whatsapp);
    setPhone(r.phone);
    setAddress(r.address);
    setPixKey(r.pix_key);
  }

  const selected = restaurants.find((r) => r.id === selectedId);

  async function handleSelect(id: string) {
    setSelectedId(id);
    const r = restaurants.find((r) => r.id === id);
    if (r) fillFields(r);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    const ok = await updateRestaurant(selected.id, {
      whatsapp,
      phone,
      address,
      pix_key: pixKey,
    });
    setSaving(false);
    if (ok) {
      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === selected.id ? { ...r, whatsapp, phone, address, pix_key: pixKey } : r,
        ),
      );
      setMessage("Configurações salvas!");
      setTimeout(() => setMessage(""), 3000);
    } else {
      setMessage("Erro ao salvar");
    }
  }

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
          Crie um restaurante primeiro
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="mt-1 text-sm text-gray-500">
          Dados do restaurante e pagamento
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {restaurants.map((r) => (
          <button
            key={r.id}
            onClick={() => handleSelect(r.id)}
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

      {selected && (
        <div className="max-w-lg space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              WhatsApp do restaurante
            </label>
            <input
              className={field}
              placeholder="5511999999999"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Telefone
            </label>
            <input
              className={field}
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Endereço
            </label>
            <input
              className={field}
              placeholder="Rua X, 123 - Bairro"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Chave PIX
            </label>
            <input
              className={field}
              placeholder="email@cnpj/chave"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
          </div>

          {message && (
            <p
              className={`text-xs ${
                message.includes("Erro") ? "text-red-400" : "text-cyan-400"
              }`}
            >
              {message}
            </p>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50 transition-colors"
          >
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      )}
    </div>
  );
}
