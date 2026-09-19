import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ShoppingBag,
  Plus,
  Minus,
  Home,
  Clock,
  ChefHat,
  UtensilsCrossed,
  MapPin,
  Phone,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Sparkles,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { usePlatformStore } from "@/modules/core/store";
import { getRestaurantBySlug, getNeighborhoods } from "@/modules/supabase/restaurants";
import { getMenuWithProducts, getAddonsByRestaurant } from "@/modules/supabase/menu";
import { supabase } from "@/modules/supabase/client";
import { createOrder } from "@/modules/supabase/orders";
import { useAuth } from "@/components/AuthProvider";
import { brl, hexToRgba, newComanda } from "@/lib/utils";
import { getOrCreateGuestId, rememberOrderId } from "@/lib/guestOrder";
import type {
  Product,
  Category,
  Restaurant,
  Order,
  DeliveryNeighborhood,
  ProductAddon,
  SelectedAddon,
} from "@/lib/types";
import CartSheet from "./CartSheet";
import CheckoutModal from "./CheckoutModal";
import type { CheckoutForm } from "./CheckoutModal";
import PaymentScreen from "./PaymentScreen";
import SuccessModal from "./SuccessModal";
import ProductAddonsModal from "./ProductAddonsModal";
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import { CidadelaBadge } from "./CidadelaBadge";
import {
  normalizeOperatingHours,
  isOpenNow,
  getTodaySchedule,
  getNextOpenInfo,
  DAY_ORDER,
  DAY_LABEL,
  formatRange,
} from "@/lib/operatingHours";

interface PublicMenuProps {
  slug: string;
}

async function ensureRestaurantFromLegacyTrial(slug: string): Promise<Restaurant | null> {
  if (!slug) return null;
  const { data: trial } = await supabase
    .from("admin_trials")
    .select("store_id, store_name, store_slogan, pix_key, whatsapp")
    .eq("store_id", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!trial) return null;

  const existing = await getRestaurantBySlug(slug);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("restaurants")
    .insert({
      owner_id: trial.store_id,
      name: trial.store_name ?? "Meu Restaurante",
      slug: trial.store_id,
      description: trial.store_slogan ?? "",
      whatsapp: trial.whatsapp ?? "",
      pix_key: trial.pix_key ?? "",
      status: "published",
    })
    .select()
    .maybeSingle();

  if (error || !data) return null;
  return data as Restaurant;
}

export default function PublicMenu({ slug }: PublicMenuProps) {
  const { cart, addToCart, removeFromCart, clearCart, setCart } = usePlatformStore();
  const { user } = useAuth();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<DeliveryNeighborhood[]>([]);
  const [productAddons, setProductAddons] = useState<ProductAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<Record<string, unknown> | null>(null);
  const [successOrder, setSuccessOrder] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const submittingRef = useRef(false);
  const sectionsRef = useRef<Record<string, HTMLElement | null>>({});
  const [now, setNow] = useState(() => new Date());
  const [addonModalProduct, setAddonModalProduct] = useState<Product | null>(null);
  const [editingCartItemIndex, setEditingCartItemIndex] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setLoadError(null);
        let r = await getRestaurantBySlug(slug);
        if (!r) r = await ensureRestaurantFromLegacyTrial(slug);
        if (!alive) return;
        if (!r) {
          setRestaurant(null);
          setCategories([]);
          setProducts([]);
          setLoading(false);
          return;
        }
        setRestaurant(r);
        const { categories: cats, products: prods } = await getMenuWithProducts(r.id);
        const [nbrs, pas] = await Promise.all([
          getNeighborhoods(r.id),
          getAddonsByRestaurant(r.id),
        ]);
        if (!alive) return;
        setCategories(cats);
        setProducts(prods);
        setNeighborhoods(nbrs);
        setProductAddons(pas);
        if (cats.length > 0) setActiveCat((prev) => prev || cats[0].id);
      } catch (e) {
        console.error("[public menu] load", e);
        if (alive) setLoadError("Falha ao carregar cardápio. Verifique sua conexão.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [slug]);

  const lastSlugRef = useRef(slug);
  useEffect(() => {
    if (lastSlugRef.current !== slug) {
      lastSlugRef.current = slug;
      setCart([]);
    }
  }, [slug, setCart]);

  const restaurantId = restaurant?.id;
  useEffect(() => {
    if (!restaurantId) return;
    const rid: string = restaurantId;
    let alive = true;

    async function refreshMenu() {
      if (!alive) return;
      try {
        const { categories: cats, products: prods } = await getMenuWithProducts(rid);
        const pas = await getAddonsByRestaurant(rid);
        if (!alive) return;
        setCategories(cats);
        setProducts(prods);
        setProductAddons(pas);
      } catch {
        /* ignore */
      }
    }
    async function refreshRestaurant() {
      if (!alive) return;
      try {
        const r = await getRestaurantBySlug(slug);
        if (!alive || !r) return;
        setRestaurant(r);
      } catch {
        /* ignore */
      }
    }

    const channel = supabase
      .channel(`public-menu-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categories",
          filter: `restaurant_id=eq.${rid}`,
        },
        refreshMenu,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `restaurant_id=eq.${rid}`,
        },
        refreshMenu,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_addons",
          filter: `restaurant_id=eq.${rid}`,
        },
        refreshMenu,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurants", filter: `id=eq.${rid}` },
        refreshRestaurant,
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [restaurantId, slug]);

  const addonsByProduct = useMemo(() => {
    const m = new Map<string, ProductAddon[]>();
    for (const a of productAddons) {
      if (!m.has(a.product_id)) m.set(a.product_id, []);
      m.get(a.product_id)!.push(a);
    }
    for (const [k, v] of m)
      m.set(
        k,
        [...v].sort((a, b) => a.sort_order - b.sort_order),
      );
    return m;
  }, [productAddons]);

  // Adicionais "globais" = sem produto ou apontando para produto inexistente
  // (registros antigos usavam um UUID sentinela em product_id).
  const globalAddons = useMemo(() => {
    const productIds = new Set(products.map((p) => p.id));
    return productAddons
      .filter((a) => !a.product_id || !productIds.has(a.product_id))
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [productAddons, products]);

  const lines = useMemo(() => {
    return cart.map((ci) => {
      const addonsPrice = ci.addons?.reduce((s, a) => s + Number(a.price), 0) ?? 0;
      const unit = Number(ci.product.price) + addonsPrice;
      return {
        item: ci.product,
        qty: ci.quantity,
        addons: ci.addons ?? [],
        notes: ci.notes ?? "",
        unitPrice: unit,
        lineTotal: unit * ci.quantity,
      };
    });
  }, [cart]);

  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  const handleRemove = useCallback(
    (productId: string, addons?: SelectedAddon[]) => removeFromCart(productId, addons),
    [removeFromCart],
  );

  // Adicionais do produto = específicos do produto + globais (dedup por nome;
  // o específico vence quando o nome coincide). Antes era um "OU": um único
  // adicional específico antigo escondia todos os globais do produto.
  function addonsForProduct(productId: string): ProductAddon[] {
    const specific = addonsByProduct.get(productId) ?? [];
    if (specific.length === 0) return globalAddons;
    const names = new Set(specific.map((a) => a.name.trim().toLowerCase()));
    const extras = globalAddons.filter((a) => !names.has(a.name.trim().toLowerCase()));
    return [...specific, ...extras];
  }

  function openAddonModal(product: Product, cartIndex?: number) {
    const available = addonsForProduct(product.id).filter((a) => a.available);
    if (available.length > 0) {
      setEditingCartItemIndex(cartIndex ?? null);
      setAddonModalProduct(product);
    }
  }

  // O botão principal adiciona o item direto ao carrinho; os adicionais são
  // escolhidos pelo botão secundário "+ adicionais".
  function handleAddSimple(product: Product) {
    addToCart(product);
  }

  function scrollToCat(id: string) {
    setActiveCat(id);
    sectionsRef.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleAddonConfirm(selected: SelectedAddon[], notes: string) {
    if (!addonModalProduct) return;

    if (editingCartItemIndex !== null) {
      const existingItem = cart[editingCartItemIndex];
      if (existingItem && existingItem.product.id === addonModalProduct.id) {
        // Substitui a linha no lugar, preservando a quantidade já escolhida.
        setCart(
          cart.map((ci, idx) =>
            idx === editingCartItemIndex ? { ...ci, addons: selected, notes } : ci,
          ),
        );
        setAddonModalProduct(null);
        setEditingCartItemIndex(null);
        return;
      }
    }

    addToCart(addonModalProduct, selected, notes);

    setAddonModalProduct(null);
    setEditingCartItemIndex(null);
  }

  async function handleCheckout(form: CheckoutForm) {
    if (!restaurant) return;
    if (
      restaurant.operating_hours &&
      !isOpenNow(restaurant.operating_hours as unknown as never, new Date())
    ) {
      const nxt = getNextOpenInfo(restaurant.operating_hours as unknown as never, new Date());
      setCheckoutError(
        nxt
          ? `Restaurante fechado agora — abre ${nxt.label.toLowerCase()} às ${nxt.time}. Tente na abertura.`
          : "Restaurante fechado no momento. Tente novamente mais tarde.",
      );
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setCheckoutError("");
    try {
      const orderItems = lines.map((l) => {
        const addonsLabel = l.addons.length ? ` (+ ${l.addons.map((a) => a.name).join(", ")})` : "";
        const notesParts: string[] = [];
        if (l.addons.length) {
          notesParts.push(
            `Adicionais: ${l.addons.map((a) => `${a.name} (+${brl(Number(a.price))})`).join(", ")}`,
          );
        }
        if (l.notes) notesParts.push(l.notes);
        return {
          product_id: l.item.id,
          product_name: l.item.name + addonsLabel,
          quantity: l.qty,
          unit_price: l.unitPrice,
          total: l.lineTotal,
          notes: notesParts.join(" | "),
        };
      });
      const comanda = newComanda();
      const deliveryFee =
        form.delivery_type === "entrega"
          ? Number(form.delivery_fee ?? restaurant.delivery_fee ?? 0)
          : 0;
      const orderTotal = subtotal + deliveryFee;
      const guestId = getOrCreateGuestId();
      // junta observações gerais + notas de itens já no notes por item
      const { order, error } = await createOrder(
        restaurant.id,
        {
          comanda,
          customer_id: user?.id ?? null,
          guest_id: guestId,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_email: form.customer_email,
          delivery_address: form.delivery_address,
          customer_complement: form.customer_complement,
          customer_neighborhood: form.customer_neighborhood,
          customer_city: form.customer_city,
          delivery_type: form.delivery_type,
          observations: form.observations,
          subtotal,
          delivery_fee: deliveryFee,
          total: orderTotal,
          payment_method: form.payment_method,
        },
        orderItems,
      );
      if (!order) {
        setCheckoutError(
          error?.message ||
            "Não foi possível concluir o pedido agora. Confira sua conexão e tente novamente.",
        );
        return;
      }
      rememberOrderId(order.id);
      clearCart();
      setCheckoutOpen(false);
      const normalized = {
        ...order,
        items: orderItems.map((i, idx) => ({ id: `${idx}`, ...i })),
        payment_method: form.payment_method,
      };
      if (form.payment_method === "pix") setPendingOrder(normalized);
      else setSuccessOrder(normalized);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  useEffect(() => {
    document.title = restaurant
      ? `${restaurant.name} — Cardápio Digital`
      : "Cardápio Digital — Cardápio Cidadela";
  }, [restaurant]);

  const accent = restaurant?.primary_color || "#06b6d4";
  const accentSoft = hexToRgba(accent, 0.14);

  const isCurrentlyOpen = useMemo(() => {
    if (!restaurant?.operating_hours) return true;
    return isOpenNow(restaurant.operating_hours as unknown as never, now);
  }, [restaurant?.operating_hours, now]);

  const nextOpen = useMemo(() => {
    if (!restaurant?.operating_hours) return null;
    return getNextOpenInfo(restaurant.operating_hours as unknown as never, now);
  }, [restaurant?.operating_hours, now]);

  const todayHours = useMemo(() => {
    if (!restaurant?.operating_hours) return null;
    return getTodaySchedule(restaurant.operating_hours as unknown as never, now);
  }, [restaurant?.operating_hours, now]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070b]">
        <div className="text-center">
          <div
            className="mx-auto size-10 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: accentSoft, borderTopColor: accent }}
          />
          <p className="mt-4 text-sm text-gray-400">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070b] px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold text-white">Falha ao carregar</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070b] px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <UtensilsCrossed className="size-7 text-gray-500" />
          </div>
          <h1 className="text-xl font-bold text-white">Cardápio não encontrado</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            O cardápio que você procura não existe ou o link está incorreto.
          </p>
          <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
            <p className="font-mono text-xs text-gray-500">/{slug}</p>
          </div>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            <Home className="size-4" /> Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  if (restaurant.status === "draft") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070b] px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <ChefHat className="size-7 text-gray-500" />
          </div>
          <h1 className="text-xl font-bold text-white">{restaurant.name}</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            Este cardápio ainda não foi publicado.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5"
          >
            <Home className="size-4" /> Página inicial
          </Link>
        </div>
      </div>
    );
  }

  if (restaurant.status === "paused") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070b] px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Clock className="size-7 text-gray-500" />
          </div>
          <h1 className="text-xl font-bold text-white">{restaurant.name}</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            Cardápio temporariamente indisponível.
          </p>
          <p className="mt-1 text-xs text-gray-500">Tente novamente mais tarde.</p>
          <a
            href={`/cardapio/${restaurant.slug}`}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            Tentar novamente
          </a>
        </div>
      </div>
    );
  }

  const currentOrder = successOrder as {
    id: string;
    comanda: string;
    total: number;
    customer_name: string;
    customer_phone: string;
    items?: { product_name: string; quantity: number; total: number }[];
    observations: string;
    payment_method: string;
    delivery_type: string;
    delivery_address: string;
    customer_complement?: string;
    customer_neighborhood?: string;
    customer_city?: string;
    delivery_fee?: number;
  } | null;

  const hasAnyProducts = categories.some((cat) =>
    products.some((p) => p.category_id === cat.id && p.available),
  );

  const hasContact = Boolean(restaurant.phone || restaurant.whatsapp || restaurant.address);
  const hasHours = Boolean(restaurant.operating_hours);

  return (
    <div className="min-h-screen bg-[#07070b] pb-6">
      {/* HERO — banner fixo com identidade da loja */}
      <div className="relative">
        <div
          className="relative h-52 w-full sm:h-64"
          style={{
            backgroundImage: restaurant.banner_url
              ? `url(${restaurant.banner_url})`
              : `radial-gradient(600px 200px at 20% 20%, ${hexToRgba(accent, 0.25)} 0%, transparent 60%), linear-gradient(135deg, #05050a 0%, #0a0a14 55%, #07070b 100%)`,
            backgroundSize: restaurant.banner_url ? "cover" : undefined,
            backgroundPosition: restaurant.banner_url ? "center center" : undefined,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#07070b] via-[#07070b]/60 to-black/10" />

          {/* Selo da Cidadela — canto superior direito, acompanha a cor do restaurante */}
          <CidadelaBadge accent={accent} className="absolute right-3 top-3 z-10" />

          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto max-w-2xl px-4 pb-4">
              <div className="flex items-end gap-3">
                {restaurant.logo_url ? (
                  <div
                    className="aspect-square size-16 shrink-0 overflow-hidden rounded-2xl border-2 shadow-lg sm:size-20"
                    style={{ borderColor: hexToRgba(accent, 0.5) }}
                  >
                    <img
                      src={restaurant.logo_url}
                      alt={restaurant.name}
                      className="size-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="grid size-16 shrink-0 place-items-center rounded-2xl border-2 bg-[#0a0a12]/90 shadow-lg sm:size-20"
                    style={{ borderColor: hexToRgba(accent, 0.5) }}
                  >
                    <UtensilsCrossed className="size-7" style={{ color: accent }} />
                  </div>
                )}

                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="min-w-0 truncate text-xl font-black tracking-tight text-white sm:text-2xl">
                      {restaurant.name}
                    </h1>
                    {restaurant.operating_hours && (
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold backdrop-blur-md ${
                          isCurrentlyOpen
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                            : "border-amber-500/30 bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${isCurrentlyOpen ? "bg-emerald-400" : "bg-amber-400"}`}
                        />
                        {isCurrentlyOpen ? "Aberto" : "Fechado"}
                      </span>
                    )}
                  </div>
                  {restaurant.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">
                      {restaurant.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso de fechado — único aviso, só aparece quando fechado */}
      {!isCurrentlyOpen && (
        <div className="mx-auto mt-3 max-w-2xl px-4">
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3.5 py-2.5">
            <Clock className="size-4 shrink-0 text-amber-300" />
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-amber-100/80">
              {nextOpen ? (
                <>
                  Abre <strong className="text-amber-200">{nextOpen.label.toLowerCase()}</strong> às{" "}
                  <strong className="text-amber-200">{nextOpen.time}</strong>
                  {todayHours && !todayHours.schedule.closed
                    ? ` — hoje fecha às ${todayHours.schedule.close}`
                    : ""}
                  .
                </>
              ) : (
                <>Hoje não há atendimento. Volte em breve!</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Info da loja (horários + contato) — recolhida por padrão */}
      {(hasHours || hasContact) && (
        <div className="mx-auto mt-3 max-w-2xl px-4">
          <button
            onClick={() => setInfoOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-gray-400">
              <Info className="size-3.5" />
              Horários e contato
            </span>
            {infoOpen ? (
              <ChevronUp className="size-4 text-gray-500" />
            ) : (
              <ChevronDown className="size-4 text-gray-500" />
            )}
          </button>

          {infoOpen && (
            <div className="mt-2 space-y-4 rounded-xl border border-white/[0.07] bg-[#0f0f17] p-4">
              {hasHours && restaurant.operating_hours && (
                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-400">
                    <Clock className="size-3.5" style={{ color: accent }} />
                    Horário de funcionamento
                  </p>
                  <div className="space-y-1">
                    {DAY_ORDER.map((k) => {
                      const hours = normalizeOperatingHours(restaurant.operating_hours as unknown);
                      if (!hours) return null;
                      const s = hours[k];
                      const isToday = DAY_LABEL[k].dow === now.getDay();
                      return (
                        <div
                          key={k}
                          className={`flex items-center justify-between rounded px-2 py-1 text-xs ${isToday ? "bg-white/[0.05]" : ""}`}
                        >
                          <span className={isToday ? "font-bold text-white" : "text-gray-400"}>
                            {DAY_LABEL[k].label}
                          </span>
                          <span
                            className={`font-semibold ${s.closed ? "text-gray-600" : "text-gray-300"}`}
                          >
                            {formatRange(s)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasContact && (
                <div className={hasHours ? "border-t border-white/5 pt-3" : ""}>
                  <div className="space-y-1.5">
                    {restaurant.whatsapp && (
                      <a
                        href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-xs text-emerald-300 hover:text-emerald-200"
                      >
                        <MessageCircle className="size-3.5" /> WhatsApp
                      </a>
                    )}
                    {restaurant.phone && (
                      <a
                        href={`tel:${restaurant.phone.replace(/\D/g, "")}`}
                        className="flex items-center gap-2 text-xs text-gray-300 hover:text-white"
                      >
                        <Phone className="size-3.5" /> {restaurant.phone}
                      </a>
                    )}
                    {restaurant.address && (
                      <p className="flex items-start gap-2 text-xs text-gray-300">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" /> {restaurant.address}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Categorias — sticky */}
      <div className="sticky top-0 z-20 mt-3 border-y border-white/5 bg-[#07070b]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => {
            const catProducts = products.filter((p) => p.category_id === c.id && p.available);
            const isActive = activeCat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => scrollToCat(c.id)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold tracking-wide transition-all ${
                  isActive
                    ? "text-white shadow-lg"
                    : "border border-white/10 bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200"
                }`}
                style={
                  isActive
                    ? {
                        backgroundColor: accent,
                        boxShadow: `0 4px 16px ${hexToRgba(accent, 0.35)}`,
                      }
                    : undefined
                }
              >
                {c.name}
                <span
                  className={`ml-1.5 text-[10px] font-semibold ${isActive ? "text-white/70" : "text-gray-600"}`}
                >
                  {catProducts.length}
                </span>
              </button>
            );
          })}
          {categories.length === 0 && (
            <span className="py-2 text-xs text-gray-600">Sem categorias</span>
          )}
        </div>
      </div>

      <main className="relative z-10 px-4 pb-32">
        <div className="mx-auto max-w-2xl">
          {!hasAnyProducts ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <ShoppingBag className="size-6 text-gray-500" />
              </div>
              <h2 className="text-base font-semibold text-white">Cardápio em breve</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm text-gray-400">
                Este estabelecimento ainda não publicou seus itens. Volte em instantes!
              </p>
            </div>
          ) : (
            categories.map((cat) => {
              const catProducts = products.filter((p) => p.category_id === cat.id && p.available);
              if (catProducts.length === 0) return null;

              return (
                <section
                  key={cat.id}
                  ref={(el) => {
                    sectionsRef.current[cat.id] = el;
                  }}
                  className="scroll-mt-16 pt-4"
                >
                  <div className="mb-2.5 flex items-center gap-3">
                    <span
                      className="h-px flex-1"
                      style={{ backgroundColor: hexToRgba(accent, 0.18) }}
                    />
                    <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white">
                      {cat.name}
                    </h2>
                    <span
                      className="h-px flex-1"
                      style={{ backgroundColor: hexToRgba(accent, 0.18) }}
                    />
                  </div>

                  <div className="grid gap-2">
                    {catProducts.map((item) => {
                      const availableAddons = addonsForProduct(item.id).filter((a) => a.available);
                      const hasAddons = availableAddons.length > 0;
                      const qtyInCart = cart
                        .filter((ci) => ci.product.id === item.id)
                        .reduce((s, ci) => s + ci.quantity, 0);
                      const canOrder = isCurrentlyOpen;

                      return (
                        <div
                          key={item.id}
                          className="relative flex gap-3 rounded-xl border bg-[#0f0f17] p-3 transition-all hover:border-white/[0.14] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                          style={{
                            borderColor: qtyInCart
                              ? hexToRgba(accent, 0.35)
                              : "rgba(255,255,255,0.07)",
                          }}
                        >
                          {qtyInCart > 0 && (
                            <span
                              className="absolute inset-y-0 left-0 w-0.5 rounded-l-xl"
                              style={{ backgroundColor: accent }}
                            />
                          )}

                          {item.image_url ? (
                            <div className="aspect-square size-[68px] shrink-0 overflow-hidden rounded-lg">
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div
                              className="grid size-[68px] shrink-0 place-items-center rounded-lg border"
                              style={{
                                borderColor: hexToRgba(accent, 0.22),
                                backgroundColor: hexToRgba(accent, 0.07),
                              }}
                            >
                              <UtensilsCrossed className="size-5" style={{ color: accent }} />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold leading-tight text-white">
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-gray-500">
                                {item.description}
                              </p>
                            )}
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <p className="text-sm font-black" style={{ color: accent }}>
                                {brl(item.price)}
                              </p>

                              <div className="flex items-center gap-2">
                                {hasAddons && (
                                  <button
                                    onClick={() =>
                                      canOrder &&
                                      openAddonModal(
                                        item,
                                        qtyInCart > 0
                                          ? cart.findIndex((ci) => ci.product.id === item.id)
                                          : undefined,
                                      )
                                    }
                                    disabled={!canOrder}
                                    title={
                                      !canOrder ? "Restaurante fechado" : "Escolher adicionais"
                                    }
                                    className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-300 transition-colors hover:border-violet-400/60 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Sparkles className="size-3" /> adicionais
                                  </button>
                                )}

                                {item.available && canOrder ? (
                                  qtyInCart > 0 ? (
                                    <div
                                      className="flex items-center gap-1 rounded-full p-0.5"
                                      style={{ backgroundColor: hexToRgba(accent, 0.15) }}
                                    >
                                      <button
                                        onClick={() => handleRemove(item.id)}
                                        className="grid size-6 place-items-center rounded-full text-white/80 hover:bg-black/40 hover:text-white"
                                        aria-label={`Remover ${item.name}`}
                                      >
                                        <Minus className="size-3" />
                                      </button>
                                      <span className="w-5 text-center text-xs font-black text-white">
                                        {qtyInCart}
                                      </span>
                                      <button
                                        onClick={() => handleAddSimple(item)}
                                        className="grid size-6 place-items-center rounded-full text-white transition-colors hover:brightness-110"
                                        style={{ backgroundColor: accent }}
                                        aria-label={`Adicionar ${item.name}`}
                                      >
                                        <Plus className="size-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleAddSimple(item)}
                                      className="grid size-8 place-items-center rounded-full text-white transition-all hover:brightness-110 active:scale-95"
                                      style={{
                                        backgroundColor: accent,
                                        boxShadow: `0 2px 10px ${hexToRgba(accent, 0.4)}`,
                                      }}
                                      aria-label={`Adicionar ${item.name}`}
                                    >
                                      <Plus className="size-4" />
                                    </button>
                                  )
                                ) : (
                                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                                    {!canOrder ? "Fechado" : "Indisponível"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>

        {/* Avaliações — some sozinha se a migração ainda não foi aplicada */}
        <div className="mx-auto mt-4 max-w-2xl px-4">
          <ReviewsSection
            restaurantId={restaurant.id}
            accent={accent}
            customerName={currentOrder?.customer_name}
          />
        </div>
      </main>

      {/* Barra flutuante do carrinho */}
      {count > 0 && !cartOpen && !checkoutOpen && !pendingOrder && !successOrder && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0a0a0f]/95 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0a0a0f]/80">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-xl text-xs font-black text-white shadow-md"
                style={{ backgroundColor: accent }}
              >
                {count}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{brl(subtotal)}</p>
                <p className="text-[11px] text-gray-400">
                  {count === 1 ? "1 item" : `${count} itens`} • sem taxa ainda
                </p>
              </div>
            </div>
            <button
              onClick={() => setCartOpen(true)}
              className="shrink-0 rounded-full px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
              style={{
                backgroundColor: accent,
                boxShadow: `0 8px 24px ${hexToRgba(accent, 0.45)}`,
              }}
            >
              Ver pedido
            </button>
          </div>
        </div>
      )}

      {cartOpen && (
        <CartSheet
          lines={lines}
          subtotal={subtotal}
          accent={accent}
          onInc={(item, addons) => addToCart(item, addons)}
          onDec={(item, addons) => removeFromCart(item.id, addons)}
          onEditAddons={(idx) => {
            const line = cart[idx];
            if (!line) return;
            openAddonModal(line.product, idx);
          }}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            if (!isCurrentlyOpen) {
              setCheckoutError(
                nextOpen
                  ? `Restaurante fechado agora — abre ${nextOpen.label.toLowerCase()} às ${nextOpen.time}. Tente novamente na abertura.`
                  : "Restaurante fechado no momento. Tente novamente mais tarde.",
              );
              setCartOpen(false);
              setCheckoutOpen(true);
            } else {
              setCheckoutError("");
              setCartOpen(false);
              setCheckoutOpen(true);
            }
          }}
        />
      )}

      {checkoutOpen && (
        <CheckoutModal
          total={subtotal}
          accent={accent}
          prefillName={user?.user_metadata?.name || ""}
          prefillPhone={user?.user_metadata?.phone || ""}
          submitting={submitting}
          serverError={
            checkoutError ||
            (!isCurrentlyOpen
              ? nextOpen
                ? `Restaurante fechado — abre ${nextOpen.label.toLowerCase()} às ${nextOpen.time}.`
                : "Restaurante fechado no momento."
              : "")
          }
          deliveryFee={Number(restaurant.delivery_fee ?? 0) || 0}
          neighborhoods={neighborhoods}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={handleCheckout}
        />
      )}

      {addonModalProduct &&
        (() => {
          const list = addonsForProduct(addonModalProduct.id);
          const editingItem = editingCartItemIndex !== null ? cart[editingCartItemIndex] : null;
          return (
            <ProductAddonsModal
              product={addonModalProduct}
              addons={list}
              initialSelected={editingItem?.addons?.map((a) => a.addon_id) ?? []}
              accent={accent}
              onClose={() => setAddonModalProduct(null)}
              onConfirm={handleAddonConfirm}
            />
          );
        })()}

      {pendingOrder && (
        <PaymentScreen
          order={pendingOrder as unknown as Order}
          pixKey={restaurant?.pix_key || ""}
          merchantName={restaurant?.name || "Meu Restaurante"}
          accent={accent}
          onSuccess={() => {
            setSuccessOrder(pendingOrder);
            setPendingOrder(null);
          }}
          onClose={() => {
            setPendingOrder(null);
            setSuccessOrder(null);
          }}
        />
      )}

      {currentOrder && (
        <SuccessModal
          order={{
            id: currentOrder.id,
            comanda: currentOrder.comanda,
            total: currentOrder.total,
            customer_name: currentOrder.customer_name,
            customer_phone: currentOrder.customer_phone,
            items:
              (currentOrder.items as { product_name: string; quantity: number; total: number }[]) ??
              [],
            observations: currentOrder.observations,
            payment_method: currentOrder.payment_method,
            delivery_type: currentOrder.delivery_type,
            delivery_address: currentOrder.delivery_address ?? "",
            customer_complement: currentOrder.customer_complement ?? "",
            customer_neighborhood: currentOrder.customer_neighborhood ?? "",
            customer_city: currentOrder.customer_city ?? "",
            delivery_fee: currentOrder.delivery_fee ?? 0,
          }}
          restaurantAccent={accent}
          restaurantName={restaurant.name}
          restaurantWhatsapp={restaurant.whatsapp}
          onClose={() => setSuccessOrder(null)}
        />
      )}

      {/* Meus pedidos — discreto, só quando carrinho vazio */}
      {count === 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <Link
            to="/meus-pedidos"
            search={{ from: slug }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2.5 text-xs font-semibold text-white/90 shadow-lg backdrop-blur transition-all hover:border-white/30 hover:bg-black/70"
            aria-label="Meus pedidos"
          >
            <ShoppingBag className="size-4" /> Meus pedidos
          </Link>
        </div>
      )}
    </div>
  );
}
