import { useEffect, useState } from "react";
import {
  Store,
  LayoutGrid,
  Sandwich,
  ClipboardList,
  Share2,
  Settings,
  Plus,
  ChevronRight,
} from "lucide-react";
import {
  getRestaurantsByOwner,
  createRestaurant,
  generateUniqueSlug,
} from "@/modules/supabase/restaurants";
import { useAuth } from "@/components/AuthProvider";
import type { Restaurant } from "@/lib/types";
import { RestaurantManager } from "./RestaurantManager";
import { MenuManager } from "./MenuManager";
import { OrderManager } from "./OrderManager";
import { SharePanel } from "./SharePanel";

type AdminTab =
  | "list"
  | "create"
  | "restaurant"
  | "menu"
  | "orders"
  | "share"
  | "settings";

const field =
  "w-full rounded-lg border border-cyan-500/30 bg-black/60 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500 focus:outline-none transition-colors";

export default function AdminDashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<Restaurant | null>(null);
  const [tab, setTab] = useState<AdminTab>("list");
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugPreview, setSlugPreview] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
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

  async function handleCreateRestaurant() {
    if (!newName.trim()) {
      setMessage("Informe o nome do restaurante");
      return;
    }
    setCreating(true);
    const slug = await generateUniqueSlug(newName);
    const restaurant = await createRestaurant(ownerId, newName, slug);
    setCreating(false);

    if (!restaurant) {
      setMessage("Erro ao criar restaurante");
      return;
    }

    setMessage("Restaurante criado com sucesso!");
    setNewName("");
    setNewSlug("");
    setSlugPreview("");
    await loadRestaurants();
    selectRestaurant(restaurant);
  }

  function selectRestaurant(r: Restaurant) {
    setSelectedRestaurant(r);
    setTab("restaurant");
  }

  if (selectedRestaurant && tab !== "list") {
    return (
      <div className="min-h-screen bg-black">
        {/* Admin header */}
        <header className="sticky top-0 z-30 border-b border-cyan-500/20 bg-black/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => {
                if (tab === "restaurant" || tab === "settings") {
                  setTab("list");
                  setSelectedRestaurant(null);
                } else {
                  setTab("restaurant");
                }
              }}
              className="text-gray-400"
              aria-label="Voltar"
            >
              ←
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold text-white">
                {selectedRestaurant.name}
              </h1>
              <p className="text-[10px] text-gray-500">
                /{selectedRestaurant.slug}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                selectedRestaurant.status === "published"
                  ? "bg-green-500/20 text-green-300"
                  : selectedRestaurant.status === "paused"
                    ? "bg-yellow-500/20 text-yellow-300"
                    : "bg-gray-500/20 text-gray-400"
              }`}
            >
              {selectedRestaurant.status === "published"
                ? "PUBLICADO"
                : selectedRestaurant.status === "paused"
                  ? "PAUSADO"
                  : "RASCUNHO"}
            </span>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-1 overflow-x-auto px-4 pb-2">
            {([
              { id: "restaurant" as AdminTab, icon: Store, label: "Dados" },
              { id: "menu" as AdminTab, icon: Sandwich, label: "Cardápio" },
              { id: "orders" as AdminTab, icon: ClipboardList, label: "Pedidos" },
              { id: "share" as AdminTab, icon: Share2, label: "Compartilhar" },
              { id: "settings" as AdminTab, icon: Settings, label: "Config" },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  tab === t.id
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-800/50 text-gray-400 hover:bg-gray-800"
                }`}
              >
                <t.icon className="size-3" />
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {/* Tab content */}
        <div className="p-4">
          {tab === "restaurant" && selectedRestaurant && (
            <RestaurantManager
              restaurant={selectedRestaurant}
              onUpdate={(r) => {
                setSelectedRestaurant(r);
                loadRestaurants();
              }}
            />
          )}

          {tab === "menu" && selectedRestaurant && (
            <MenuManager restaurant={selectedRestaurant} />
          )}

          {tab === "orders" && selectedRestaurant && (
            <OrderManager restaurant={selectedRestaurant} />
          )}

          {tab === "share" && selectedRestaurant && (
            <SharePanel restaurant={selectedRestaurant} />
          )}

          {tab === "settings" && selectedRestaurant && (
            <SettingsPanel
              restaurant={selectedRestaurant}
              onUpdate={(r) => {
                setSelectedRestaurant(r);
                loadRestaurants();
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // Restaurant list / create
  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-cyan-500/20 px-4 py-4">
        <h1 className="text-lg font-bold text-white">Minhas Lojas</h1>
        <p className="text-xs text-gray-500">Gerencie seus restaurantes</p>
      </header>

      <div className="p-4">
        {message && (
          <div className="mb-4 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3 text-xs text-cyan-200">
            {message}
          </div>
        )}

        {/* Restaurant list */}
        {!loading && restaurants.length === 0 && (
          <div className="py-12 text-center">
            <Store className="mx-auto size-12 text-gray-700" />
            <p className="mt-4 text-sm text-gray-400">
              Nenhum restaurante criado ainda
            </p>
            <p className="mt-1 text-xs text-gray-600">
              Crie seu primeiro restaurante para começar
            </p>
          </div>
        )}

        {restaurants.map((r) => (
          <button
            key={r.id}
            onClick={() => selectRestaurant(r)}
            className="mb-3 flex w-full items-center gap-3 rounded-xl border border-cyan-500/20 bg-black/40 p-4 text-left transition-all hover:border-cyan-500/40"
          >
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: r.primary_color + "33" }}
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
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{r.name}</p>
              <p className="text-[10px] text-gray-500">/{r.slug}</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                r.status === "published"
                  ? "bg-green-500/20 text-green-300"
                  : r.status === "paused"
                    ? "bg-yellow-500/20 text-yellow-300"
                    : "bg-gray-500/20 text-gray-400"
              }`}
            >
              {r.status === "published"
                ? "PUBLICADO"
                : r.status === "paused"
                  ? "PAUSADO"
                  : "RASCUNHO"}
            </span>
            <ChevronRight className="size-4 shrink-0 text-gray-600" />
          </button>
        ))}

        {/* Create new restaurant */}
        <div className="mt-6 rounded-xl border border-dashed border-cyan-500/30 p-4">
          <h3 className="mb-3 text-sm font-bold text-white">
            Criar novo restaurante
          </h3>
          <input
            className={field}
            placeholder="Nome do restaurante"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              // Auto-generate slug preview
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
          />
          {slugPreview && (
            <div className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2">
              <p className="text-[10px] text-gray-500">URL do cardápio:</p>
              <p className="text-xs text-cyan-300">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/cardapio/${slugPreview}`
                  : `/cardapio/${slugPreview}`}
              </p>
            </div>
          )}
          <button
            onClick={handleCreateRestaurant}
            disabled={creating || !newName.trim()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            <Plus className="size-4" />{" "}
            {creating ? "Criando..." : "Criar restaurante"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({
  restaurant,
  onUpdate,
}: {
  restaurant: Restaurant;
  onUpdate: (r: Restaurant) => void;
}) {
  const [whatsapp, setWhatsapp] = useState(restaurant.whatsapp);
  const [phone, setPhone] = useState(restaurant.phone);
  const [address, setAddress] = useState(restaurant.address);
  const [pixKey, setPixKey] = useState(restaurant.pix_key);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    const { updateRestaurant } = await import(
      "@/modules/supabase/restaurants"
    );
    const ok = await updateRestaurant(restaurant.id, {
      whatsapp,
      phone,
      address,
      pix_key: pixKey,
    });
    setSaving(false);
    if (ok) {
      onUpdate({ ...restaurant, whatsapp, phone, address, pix_key: pixKey });
      setMessage("Configurações salvas!");
    } else {
      setMessage("Erro ao salvar");
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white">Configurações</h3>

      <input
        className={field}
        placeholder="WhatsApp do restaurante"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
      />
      <input
        className={field}
        placeholder="Telefone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        className={field}
        placeholder="Endereço"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <input
        className={field}
        placeholder="Chave PIX"
        value={pixKey}
        onChange={(e) => setPixKey(e.target.value)}
      />

      {message && (
        <p className="text-xs text-cyan-300">{message}</p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-lg bg-cyan-600 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar configurações"}
      </button>
    </div>
  );
}
