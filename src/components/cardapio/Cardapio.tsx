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
  Sparkles,
  Flame,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { usePlatformStore } from "@/modules/core/store";
import { getRestaurantBySlug, getNeighborhoods } from "@/modules/supabase/restaurants";
import { getMenuWithProducts } from "@/modules/supabase/menu";
import { supabase } from "@/modules/supabase/client";
import { createOrder } from "@/modules/supabase/orders";
import { useAuth } from "@/components/AuthProvider";
import { brl, hexToRgba, newComanda } from "@/lib/utils";
import { getOrCreateGuestId, rememberOrderId } from "@/lib/guestOrder";
import type { Product, Category, Restaurant, Order, DeliveryNeighborhood } from "@/lib/types";
import CartSheet from "./CartSheet";
import CheckoutModal from "./CheckoutModal";
import type { CheckoutForm } from "./CheckoutModal";
import PaymentScreen from "./PaymentScreen";
import SuccessModal from "./SuccessModal";
import {
  normalizeOperatingHours,
  isOpenNow,
  getTodaySchedule,
  getNextOpenInfo,
  getClosesAt,
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

function OpenBadge({
  restaurant,
  now,
}: {
  restaurant: Restaurant;
  accent: string;
  now: Date;
}) {
  const hasHours = Boolean(restaurant.operating_hours);
  const open = hasHours ? isOpenNow(restaurant.operating_hours as unknown as never, now) : true;
  const today = hasHours ? getTodaySchedule(restaurant.operating_hours as unknown as never, now) : null;
  const closesAt = hasHours && open ? getClosesAt(restaurant.operating_hours as unknown as never, now) : null;
  const next = hasHours && !open ? getNextOpenInfo(restaurant.operating_hours as unknown as never, now) : null;

  if (!hasHours) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold backdrop-blur-md ${
        open
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
    >
      <span className="relative flex size-2">
        <span
          className={`absolute inline-flex size-2 animate-ping rounded-full opacity-75 ${open ? "bg-emerald-400" : "bg-red-400"}`}
        />
        <span className={`relative inline-flex size-2 rounded-full ${open ? "bg-emerald-400" : "bg-red-400"}`} />
      </span>
      {open ? (
        <>
          Aberto agora
          {closesAt && <span className="font-normal opacity-80">• fecha às {closesAt}</span>}
        </>
      ) : (
        <>
          Fechado agora
          {next ? (
            <span className="font-normal opacity-80">• abre {next.label.toLowerCase()} às {next.time}</span>
          ) : today?.schedule.closed ? (
            <span className="font-normal opacity-80">• hoje fechado</span>
          ) : null}
        </>
      )}
    </div>
  );
}

function HoursPanel({
  restaurant,
  accent,
  now,
}: {
  restaurant: Restaurant;
  accent: string;
  now: Date;
}) {
  const [open, setOpen] = useState(false);
  const hours = restaurant.operating_hours ? normalizeOperatingHours(restaurant.operating_hours as unknown) : null;
  if (!hours) return null;
  const isOpen = isOpenNow(hours as unknown as never, now);

  return (
    <div className="mx-auto max-w-2xl px-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left backdrop-blur transition-colors hover:bg-white/[0.06]"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Clock className="size-4" style={{ color: accent }} />
          Horário de funcionamento
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide ${
              isOpen ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/15 text-red-300"
            }`}
          >
            {isOpen ? "ABERTO" : "FECHADO"}
          </span>
        </span>
        {open ? <ChevronUp className="size-4 text-gray-500" /> : <ChevronDown className="size-4 text-gray-500" />}
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f17]">
          <div className="divide-y divide-white/[0.06]">
            {DAY_ORDER.map((k) => {
              const s = hours[k];
              const isToday = DAY_LABEL[k].dow === now.getDay();
              return (
                <div
                  key={k}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm ${isToday ? "bg-white/[0.04]" : ""}`}
                >
                  <span className={`flex items-center gap-2 ${isToday ? "font-bold text-white" : "text-gray-400"}`}>
                    {isToday && <span className="size-1.5 rounded-full" style={{ backgroundColor: accent }} />}
                    {DAY_LABEL[k].label}
                    {isToday && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">HOJE</span>}
                  </span>
                  <span
                    className={`text-xs font-semibold ${s.closed ? "text-gray-500" : isToday ? "text-white" : "text-gray-300"}`}
                  >
                    {formatRange(s)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="border-t border-white/5 bg-white/[0.02] px-4 py-2.5 text-center text-[11px] text-gray-500">
            Horário de Brasília • viradas após meia-noite contam como o dia anterior
          </p>
        </div>
      )}
    </div>
  );
}

export default function PublicMenu({ slug }: PublicMenuProps) {
  const { cart, addToCart, removeFromCart, clearCart, setCart } = usePlatformStore();
  const { user } = useAuth();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<DeliveryNeighborhood[]>([]);
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
        const [nbrs] = await Promise.all([getNeighborhoods(r.id)]);
        if (!alive) return;
        setCategories(cats);
        setProducts(prods);
        setNeighborhoods(nbrs);
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

  useEffect(() => {
    if (!restaurant) return;
    const restaurantId = restaurant.id;
    let alive = true;

    async function refreshMenu() {
      if (!alive) return;
      try {
        const { categories: cats, products: prods } = await getMenuWithProducts(restaurantId);
        if (!alive) return;
        setCategories(cats);
        setProducts(prods);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "categories", filter: `restaurant_id=eq.${restaurantId}` }, refreshMenu)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `restaurant_id=eq.${restaurantId}` }, refreshMenu)
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurants", filter: `id=eq.${restaurantId}` }, refreshRestaurant)
      .subscribe();

    const interval = setInterval(() => {
      refreshMenu();
      refreshRestaurant();
    }, 30_000);

    return () => {
      alive = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id, slug]);

  const lines = useMemo(() => cart.map((ci) => ({ item: ci.product, qty: ci.quantity })), [cart]);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.item.price * l.qty, 0);

  const add = useCallback((product: Product) => addToCart(product), [addToCart]);
  const remove = useCallback((productId: string) => removeFromCart(productId), [removeFromCart]);

  function scrollToCat(id: string) {
    setActiveCat(id);
    sectionsRef.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleCheckout(form: CheckoutForm) {
    if (!restaurant) return;
    // Bloqueia envio se estiver fechado (UX clara)
    if (restaurant.operating_hours && !isOpenNow(restaurant.operating_hours as unknown as never, new Date())) {
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
      const orderItems = lines.map((l) => ({
        product_id: l.item.id,
        product_name: l.item.name,
        quantity: l.qty,
        unit_price: l.item.price,
        total: l.item.price * l.qty,
        notes: "",
      }));
      const comanda = newComanda();
      const deliveryFee =
        form.delivery_type === "entrega" ? Number(form.delivery_fee ?? restaurant.delivery_fee ?? 0) : 0;
      const orderTotal = subtotal + deliveryFee;
      const guestId = getOrCreateGuestId();
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
        setCheckoutError(error?.message || "Não foi possível concluir o pedido agora. Confira sua conexão e tente novamente.");
        return;
      }
      // Garante que o pedido fique acessível mesmo se o cliente fechar a
      // página antes de tocar em "Acompanhar pedido" — exibe em /meus-pedidos.
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
    document.title = restaurant ? `${restaurant.name} — Cardápio Digital` : "Cardápio Digital — Cardápio Cidadela";
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
          <div className="mx-auto size-10 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: `${accentSoft}`, borderTopColor: accent }} />
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
          <button onClick={() => window.location.reload()} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500">
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
          <p className="mt-2 text-sm leading-relaxed text-gray-400">O cardápio que você procura não existe ou o link está incorreto.</p>
          <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
            <p className="font-mono text-xs text-gray-500">/{slug}</p>
          </div>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500">
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
          <p className="mt-2 text-sm leading-relaxed text-gray-400">Este cardápio ainda não foi publicado.</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5">
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
          <p className="mt-2 text-sm leading-relaxed text-gray-400">Cardápio temporariamente indisponível.</p>
          <p className="mt-1 text-xs text-gray-500">Tente novamente mais tarde.</p>
          <a href={`/cardapio/${restaurant.slug}`} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500">
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

  const hasAnyProducts = categories.some((cat) => products.some((p) => p.category_id === cat.id && p.available));

  return (
    <div className="min-h-screen bg-[#07070b] pb-6">
      {/* Top utility bar — open/closed */}
      {restaurant.operating_hours && (
        <div
          className={`sticky top-0 z-30 border-b backdrop-blur-xl ${
            isCurrentlyOpen ? "border-emerald-500/20 bg-emerald-600/10" : "border-amber-500/20 bg-amber-500/10"
          }`}
        >
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-bold">
              <span className={`size-2 animate-pulse rounded-full ${isCurrentlyOpen ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span className={isCurrentlyOpen ? "text-emerald-300" : "text-amber-300"}>
                {isCurrentlyOpen ? "Aberto agora" : "Fechado agora"}
              </span>
              <span className="hidden font-normal text-white/60 sm:inline">—</span>
              <span className="hidden text-xs font-normal text-white/70 sm:inline">
                {todayHours?.schedule.closed ? "hoje fechado" : todayHours ? `${todayHours.schedule.open} — ${todayHours.schedule.close}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-[11px] font-medium text-white/70">
              {isCurrentlyOpen ? (
                <>{getClosesAt(restaurant.operating_hours as unknown as never, now) && <>fecha às {getClosesAt(restaurant.operating_hours as unknown as never, now)}</>}</>
              ) : nextOpen ? (
                <>abre {nextOpen.label.toLowerCase()} às {nextOpen.time}</>
              ) : null}
            </span>
          </div>
        </div>
      )}

      {/* HERO — premium */}
      <div className="relative overflow-hidden">
        {/* banner */}
        <div
          className="relative h-[280px] w-full sm:h-[340px]"
          style={{
            backgroundImage: restaurant.banner_url
              ? `url(${restaurant.banner_url})`
              : `radial-gradient(800px 400px at 20% 20%, ${hexToRgba(accent, 0.35)} 0%, transparent 60%), radial-gradient(700px 500px at 90% 10%, ${hexToRgba(accent, 0.18)} 0%, transparent 60%), linear-gradient(135deg, #05050a 0%, #0a0a14 55%, #07070b 100%)`,
            backgroundSize: restaurant.banner_url ? "cover" : undefined,
            backgroundPosition: restaurant.banner_url ? "center" : undefined,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#07070b] via-[#07070b]/60 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />

          {/* subtle grain */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.95'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

          <Link
            to="/meus-pedidos"
            search={{ from: slug }}
            className="absolute left-3 top-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur transition-colors hover:border-white/30 hover:bg-black/70"
            aria-label="Meus pedidos"
          >
            <ShoppingBag className="size-3.5" /> Meus pedidos
          </Link>

          {/* centered content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            {/* logo */}
            <div className="relative">
              <div className="absolute -inset-3 rounded-[28px] opacity-30 blur-xl" style={{ backgroundColor: accent }} />
              {restaurant.logo_url ? (
                <img
                  src={restaurant.logo_url}
                  alt={restaurant.name}
                  className="relative size-24 rounded-[20px] border border-white/20 object-cover shadow-[0_20px_60px_rgba(0,0,0,0.6)] sm:size-28"
                />
              ) : (
                <div
                  className="relative grid size-24 place-items-center rounded-[20px] border bg-[#0a0a12]/90 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur sm:size-28"
                  style={{ borderColor: hexToRgba(accent, 0.4) }}
                >
                  <UtensilsCrossed className="size-9" style={{ color: accent }} />
                </div>
              )}
            </div>

            <h1 className="mt-4 max-w-lg text-balance text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.7)] sm:text-4xl">
              {restaurant.name}
            </h1>
            {(restaurant.description || restaurant.slogan) && (
              <p className="mx-auto mt-2 max-w-md text-balance text-sm leading-relaxed text-white/80 sm:text-[15px]">
                {restaurant.description || `“${restaurant.slogan}”`}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <OpenBadge restaurant={restaurant} accent={accent} now={now} />
              {restaurant.address && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
                  <MapPin className="size-3.5 opacity-70" /> {restaurant.address.slice(0, 32)}
                  {restaurant.address.length > 32 ? "…" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Cidadela floating pill — refinado */}
          <a
            href="https://pracinha.online"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 z-20 hidden items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-2 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-black/60 hover:scale-[1.02] sm:flex"
          >
            <Sparkles className="size-3.5 text-cyan-400" />
            Conheça a Cidadela
          </a>

          <a
            href="https://pracinha.online"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-3 top-3 z-20 flex size-14 items-center justify-center rounded-full border-2 bg-black/40 text-[8px] font-black leading-none tracking-widest text-yellow-300 backdrop-blur sm:hidden"
            style={{ borderColor: "rgba(0,230,255,0.6)", boxShadow: "0 0 18px rgba(0,230,255,0.4)" }}
          >
            <span className="text-center">
              CONHEÇA
              <br />
              CIDADELA
            </span>
          </a>
        </div>

        {/* info cards under hero */}
        <div className="mx-auto -mt-6 max-w-2xl px-4">
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#101018]/90 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:gap-3 sm:p-3">
            <div className="rounded-xl bg-white/[0.04] px-3 py-3 text-center">
              <Clock className="mx-auto size-4 text-gray-500" />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Entrega</p>
              <p className="text-xs font-bold text-white">30–45 min</p>
            </div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-3 text-center">
              <Flame className="mx-auto size-4" style={{ color: accent }} />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Avaliação</p>
              <p className="text-xs font-bold text-white">4.9 ★</p>
            </div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-3 text-center">
              <ShoppingBag className="mx-auto size-4 text-gray-500" />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Pedido mín.</p>
              <p className="text-xs font-bold text-white">sem mínimo</p>
            </div>
          </div>

          {/* contact row */}
          {(restaurant.phone || restaurant.whatsapp) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
              {restaurant.whatsapp && (
                <a
                  href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-300 hover:bg-emerald-500/15"
                >
                  <MessageCircle className="size-3.5" /> WhatsApp
                </a>
              )}
              {restaurant.phone && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-gray-300">
                  <Phone className="size-3.5" /> {restaurant.phone}
                </span>
              )}
              {restaurant.address && (
                <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-gray-300 sm:inline-flex">
                  <MapPin className="size-3.5" /> {restaurant.address}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* hours panel */}
      <div className="mt-5">
        <HoursPanel restaurant={restaurant} accent={accent} now={now} />
      </div>

      {/* closed banner — quando fechado, bem bonito */}
      {!isCurrentlyOpen && (
        <div className="mx-auto mt-4 max-w-2xl px-4">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 p-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/15">
              <Clock className="size-5 text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-200">Restaurante fechado agora</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-100/70">
                {nextOpen ? (
                  <>
                    Abre <strong className="text-amber-200">{nextOpen.label.toLowerCase()}</strong> às{" "}
                    <strong className="text-amber-200">{nextOpen.time}</strong>. Você pode navegar no cardápio, mas o
                    pedido só poderá ser finalizado quando estiver aberto.
                  </>
                ) : (
                  <>Hoje não há atendimento. Volte em breve!</>
                )}
              </p>
              {todayHours && !todayHours.schedule.closed && (
                <p className="mt-1 text-[11px] text-amber-100/60">
                  Hoje: {todayHours.schedule.open} — {todayHours.schedule.close}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* categories — sticky */}
      <div className="sticky top-[41px] z-20 mt-6 border-y border-white/5 bg-[#07070b]/80 backdrop-blur-xl sm:top-[37px]">
        <div className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => {
            const catProducts = products.filter((p) => p.category_id === c.id && p.available);
            const isActive = activeCat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => scrollToCat(c.id)}
                className={`group relative shrink-0 rounded-full px-4 py-2.5 text-xs font-bold tracking-wide transition-all ${
                  isActive ? "text-white shadow-lg" : "border border-white/10 bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200"
                }`}
                style={
                  isActive
                    ? { backgroundColor: accent, boxShadow: `0 8px 24px ${hexToRgba(accent, 0.35)}`, borderColor: accent }
                    : undefined
                }
              >
                {c.name}{" "}
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-white/10 text-gray-500 group-hover:text-gray-300"}`}
                >
                  {catProducts.length}
                </span>
              </button>
            );
          })}
          {categories.length === 0 && <span className="py-2 text-xs text-gray-600">Sem categorias</span>}
        </div>
      </div>

      <main className="px-4 pb-28">
        <div className="mx-auto max-w-2xl">
          {!hasAnyProducts ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <ShoppingBag className="size-6 text-gray-500" />
              </div>
              <h2 className="text-base font-semibold text-white">Cardápio em breve</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm text-gray-400">Este estabelecimento ainda não publicou seus itens. Volte em instantes!</p>
            </div>
          ) : (
            categories.map((cat) => {
              const catProducts = products.filter((p) => p.category_id === cat.id && p.available);
              if (catProducts.length === 0) return null;

              return (
                <section key={cat.id} ref={(el) => { sectionsRef.current[cat.id] = el; }} className="scroll-mt-28 pt-8">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="h-px flex-1" style={{ backgroundColor: hexToRgba(accent, 0.18) }} />
                    <h2 className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white">
                      {cat.name}
                    </h2>
                    <span className="h-px flex-1" style={{ backgroundColor: hexToRgba(accent, 0.18) }} />
                  </div>

                  <div className="grid gap-3">
                    {catProducts.map((item) => {
                      const inCart = cart.find((ci) => ci.product.id === item.id);
                      const canOrder = isCurrentlyOpen;
                      return (
                        <div
                          key={item.id}
                          className="group relative flex gap-4 overflow-hidden rounded-2xl border bg-[#0f0f17] p-3 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] sm:p-4"
                          style={{ borderColor: inCart ? hexToRgba(accent, 0.35) : "rgba(255,255,255,0.07)" }}
                        >
                          {/* accent left bar when in cart */}
                          {inCart && <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: accent }} />}

                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="size-20 shrink-0 rounded-xl object-cover sm:size-24" loading="lazy" />
                          ) : (
                            <div
                              className="grid size-20 shrink-0 place-items-center rounded-xl border sm:size-24"
                              style={{ borderColor: hexToRgba(accent, 0.22), backgroundColor: hexToRgba(accent, 0.07) }}
                            >
                              <UtensilsCrossed className="size-6" style={{ color: accent }} />
                            </div>
                          )}

                          <div className="min-w-0 flex-1 py-0.5">
                            <p className="line-clamp-1 text-[15px] font-bold leading-tight text-white">{item.name}</p>
                            {item.description && (
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-400">{item.description}</p>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <p className="text-sm font-black" style={{ color: accent }}>
                                {brl(item.price)}
                              </p>
                              {!canOrder && (
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">fechado</span>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col justify-center">
                            {item.available ? (
                              <>
                                {inCart ? (
                                  <div
                                    className="flex items-center gap-1 rounded-full border p-1 shadow-md"
                                    style={{ borderColor: hexToRgba(accent, 0.35), backgroundColor: hexToRgba(accent, 0.1) }}
                                  >
                                    <button
                                      onClick={() => remove(item.id)}
                                      className="grid size-8 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
                                      aria-label={`Remover ${item.name}`}
                                    >
                                      <Minus className="size-3.5" />
                                    </button>
                                    <span className="w-6 text-center text-sm font-black text-white">{inCart.quantity}</span>
                                    <button
                                      onClick={() => add(item)}
                                      disabled={!canOrder}
                                      className="grid size-8 place-items-center rounded-full text-white transition-colors hover:brightness-110 disabled:opacity-40"
                                      style={{ backgroundColor: accent }}
                                      aria-label={`Adicionar ${item.name}`}
                                    >
                                      <Plus className="size-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => canOrder && add(item)}
                                    disabled={!canOrder}
                                    title={!canOrder ? "Restaurante fechado" : "Adicionar ao pedido"}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-xs font-black uppercase tracking-wide transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${canOrder ? "hover:shadow-lg hover:brightness-110" : ""}`}
                                    style={{
                                      borderColor: hexToRgba(accent, canOrder ? 0.5 : 0.2),
                                      color: canOrder ? accent : "#6b7280",
                                      backgroundColor: hexToRgba(accent, canOrder ? 0.09 : 0.04),
                                    }}
                                  >
                                    <Plus className="size-3.5" /> Add
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Indisponível</span>
                            )}
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
      </main>

      {/* footer */}
      <footer className="mx-auto max-w-2xl px-4 pb-6">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-4 text-center">
          <p className="text-xs font-semibold text-gray-400">{restaurant.name} • Cardápio Digital</p>
          <p className="mt-1 text-[11px] text-gray-600">Feito com ♥ no Cardápio Cidadela • pracinha.online</p>
        </div>
      </footer>

      {/* Floating cart bar — premium */}
      {count > 0 && !cartOpen && !checkoutOpen && !pendingOrder && !successOrder && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0a0a0f]/95 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0a0a0f]/80">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl text-xs font-black text-white shadow-md" style={{ backgroundColor: accent }}>
                {count}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">{count === 1 ? "1 item" : `${count} itens`} • {brl(subtotal)}</p>
                <p className="text-[11px] text-gray-400">Toque para revisar seu pedido</p>
              </div>
            </div>
            <button
              onClick={() => setCartOpen(true)}
              className="shrink-0 rounded-full px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ backgroundColor: accent, boxShadow: `0 8px 24px ${hexToRgba(accent, 0.45)}` }}
            >
              Ver pedido
            </button>
          </div>
          {!isCurrentlyOpen && (
            <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] font-medium text-amber-300">
              Restaurante fechado — você pode montar o carrinho, mas o envio será liberado na abertura.
            </p>
          )}
        </div>
      )}

      {cartOpen && (
        <CartSheet
          lines={lines}
          subtotal={subtotal}
          accent={accent}
          onInc={(id) => {
            const product = products.find((p) => p.id === id);
            if (product) add(product);
          }}
          onDec={remove}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            if (!isCurrentlyOpen) {
              setCheckoutError(
                nextOpen
                  ? `Restaurante fechado agora — abre ${nextOpen.label.toLowerCase()} às ${nextOpen.time}. Tente novamente na abertura.`
                  : "Restaurante fechado no momento. Tente novamente mais tarde.",
              );
            } else {
              setCheckoutError("");
            }
            setCartOpen(false);
            setCheckoutOpen(true);
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
            (!isCurrentlyOpen ? (nextOpen ? `Restaurante fechado — abre ${nextOpen.label.toLowerCase()} às ${nextOpen.time}.` : "Restaurante fechado no momento.") : "")
          }
          deliveryFee={Number(restaurant.delivery_fee ?? 0) || 0}
          neighborhoods={neighborhoods}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={handleCheckout}
        />
      )}

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
            items: (currentOrder.items as { product_name: string; quantity: number; total: number }[]) ?? [],
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
    </div>
  );
}
