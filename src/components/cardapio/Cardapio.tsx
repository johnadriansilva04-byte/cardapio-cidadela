import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ShoppingBag, Plus, Minus, Home, Clock, ChefHat, UtensilsCrossed } from "lucide-react";
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

  // Load restaurant and menu — single source, no duplicate polling on mount
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

  // Clear cart when restaurant slug changes — but only once per slug
  const lastSlugRef = useRef(slug);
  useEffect(() => {
    if (lastSlugRef.current !== slug) {
      lastSlugRef.current = slug;
      setCart([]);
    }
  }, [slug, setCart]);

  // Realtime: reload when admin edits menu; polling as lightweight fallback every 30s
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
        /* ignore transient */
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
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        refreshMenu,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        refreshMenu,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurants",
          filter: `id=eq.${restaurantId}`,
        },
        refreshRestaurant,
      )
      .subscribe();

    // Fallback polling every 30s (covers cases where Realtime is disabled in DB)
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

  const lines = useMemo(
    () =>
      cart.map((ci) => ({
        item: ci.product,
        qty: ci.quantity,
      })),
    [cart],
  );

  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.item.price * l.qty, 0);

  const add = useCallback(
    (product: Product) => {
      addToCart(product);
    },
    [addToCart],
  );

  const remove = useCallback(
    (productId: string) => {
      removeFromCart(productId);
    },
    [removeFromCart],
  );

  function scrollToCat(id: string) {
    setActiveCat(id);
    sectionsRef.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleCheckout(form: CheckoutForm) {
    if (!restaurant) return;
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
      const customerPhone = form.customer_phone;
      const customerName = form.customer_name;
      const deliveryFee =
        form.delivery_type === "entrega"
          ? Number(form.delivery_fee ?? restaurant.delivery_fee ?? 0)
          : 0;
      const orderTotal = subtotal + deliveryFee;

      const guestId = getOrCreateGuestId();
      const { order, error } = await createOrder(
        restaurant.id,
        {
          comanda,
          customer_id: user?.id ?? null,
          guest_id: guestId,
          customer_name: customerName,
          customer_phone: customerPhone,
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
      if (form.payment_method === "pix") {
        setPendingOrder(normalized);
      } else {
        setSuccessOrder(normalized);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (restaurant) {
      document.title = `${restaurant.name} — Cardápio Digital`;
    } else {
      document.title = "Cardápio Digital — Cardápio Cidadela";
    }
  }, [restaurant]);

  const accent = restaurant?.primary_color || "#06b6d4";
  const accentSoft = hexToRgba(accent, 0.14);
  const accentBorder = hexToRgba(accent, 0.4);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070b]">
        <div className="text-center">
          <div
            className="mx-auto size-10 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: `${accentSoft}`, borderTopColor: accent }}
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
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-500"
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
            O cardápio que você procura não existe ou o link está incorreto. Confira o endereço ou
            fale com o estabelecimento.
          </p>
          <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
            <p className="font-mono text-xs text-gray-500">/{slug}</p>
          </div>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-500"
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
          <p className="mt-1 text-xs text-gray-500">
            Volte em instantes ou contate o estabelecimento.
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
  } | null;

  const hasAnyProducts = categories.some((cat) =>
    products.some((p) => p.category_id === cat.id && p.available),
  );

  return (
    <div className="min-h-screen bg-[#07070b]">
      <div className="relative overflow-hidden">
        <div
          className="h-60 w-full bg-cover bg-center bg-no-repeat sm:h-72"
          style={{
            backgroundImage: restaurant.banner_url
              ? `url(${restaurant.banner_url})`
              : `linear-gradient(135deg, ${hexToRgba(accent, 0.55)} 0%, #05050a 75%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[#07070b]" />

        <Link
          to="/meus-pedidos"
          search={{ from: slug }}
          className="absolute left-3 top-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur transition-colors hover:border-white/30 hover:bg-black/70"
          aria-label="Meus pedidos"
        >
          <ShoppingBag className="size-3.5" /> Meus pedidos
        </Link>

        <div className="absolute left-0 right-0 top-10 px-4 text-center sm:top-14">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="mx-auto mb-3 size-20 rounded-2xl border-2 border-white/25 object-cover shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:size-24"
            />
          ) : (
            <div
              className="mx-auto mb-3 flex size-20 items-center justify-center rounded-2xl border bg-[#0a0a12] shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:size-24"
              style={{ borderColor: accentBorder }}
            >
              <UtensilsCrossed className="size-8" style={{ color: accent }} />
            </div>
          )}

          <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-lg sm:text-3xl">
            {restaurant.name}
          </h1>
          {restaurant.description ? (
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-gray-300/90 sm:text-sm">
              {restaurant.description}
            </p>
          ) : (
            restaurant.slogan && (
              <p className="mt-1.5 text-sm italic text-gray-300/80">
                &quot;{restaurant.slogan}&quot;
              </p>
            )
          )}
        </div>

        <a
          href="https://pracinha.online"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-3 top-[9.5rem] z-50 group flex size-20 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 sm:size-24"
          style={{
            background: `radial-gradient(ellipse at 30% 30%, #00E6FF 0%, #0891b2 28%, #0a0a18 78%)`,
            border: `2.5px solid #00E6FF`,
            boxShadow: `0 0 18px rgba(0,230,255,0.6), 0 0 40px rgba(0,230,255,0.25), 0 4px 20px rgba(0,0,0,0.6)`,
          }}
          aria-label="Conheça a Cidadela"
        >
          {/* outer neon glow ring — pulsante */}
          <span
            className="pointer-events-none absolute inset-[-4px] rounded-full animate-pulse opacity-60"
            style={{ border: `2px solid rgba(0,230,255,0.4)`, filter: "blur(1px)" }}
          />
          {/* inner circle fill */}
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(ellipse at 30% 30%, rgba(0,230,255,0.22) 0%, transparent 60%)`,
            }}
          />
          {/* spray-drip texture dots */}
          <span
            className="pointer-events-none absolute inset-1 rounded-full opacity-[0.08]"
            style={{
              background: `radial-gradient(circle at 25% 65%, #00E6FF 1px, transparent 1px), radial-gradient(circle at 75% 45%, #00E6FF 1px, transparent 1px), radial-gradient(circle at 50% 85%, #00E6FF 0.8px, transparent 0.8px)`,
            }}
          />
          {/* content — grafite / piche hand-tag look: preto/amarelo neon pulsante */}
          <span className="relative flex flex-col items-center justify-center px-2 text-center">
            <span
              className="font-black leading-none tracking-[0.08em]"
              style={{
                fontFamily: "'Permanent Marker','Bangers',cursive",
                fontSize: "11px",
                color: "#FACC15",
                WebkitTextStroke: "0.3px rgba(0,0,0,0.85)",
                textShadow: `0 0 6px rgba(250,204,21,0.95), 0 0 16px rgba(250,204,21,0.5), 1px 1px 0 rgba(0,0,0,0.85)`,
                transform: "rotate(-3deg)",
                animation: "graf-pulse 1.6s ease-in-out infinite",
              }}
            >
              CONHEÇA
            </span>
            <span
              className="font-black leading-none tracking-[0.12em]"
              style={{
                fontFamily: "'Permanent Marker','Bangers',cursive",
                fontSize: "13px",
                color: "#FACC15",
                WebkitTextStroke: "0.35px rgba(0,0,0,0.9)",
                textShadow: `0 0 8px rgba(250,204,21,1), 0 0 18px rgba(250,204,21,0.55), 0 0 30px rgba(0,230,255,0.35), 1px 1px 0 rgba(0,0,0,0.9)`,
                transform: "rotate(-3deg)",
                animation: "graf-pulse 1.6s ease-in-out infinite 0.12s",
              }}
            >
              A CIDADELA
            </span>
            {/* drip + lock icon */}
            <span className="mt-0.5 flex items-center gap-1 opacity-90">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FACC15"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5"
                style={{ filter: `drop-shadow(0 0 4px rgba(250,204,21,0.9))` }}
              >
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <span
                className="text-[7px] font-bold tracking-[0.2em]"
                style={{ color: "#FACC15", textShadow: "0 0 6px rgba(250,204,21,0.7)" }}
              >
                PRACINHA
              </span>
            </span>
          </span>
        </a>
      </div>

      <div
        className="sticky top-0 z-20 border-b bg-[#07070b]/90 backdrop-blur"
        style={{ borderColor: hexToRgba(accent, 0.18) }}
      >
        <div className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => {
            const catProducts = products.filter((p) => p.category_id === c.id && p.available);
            return (
              <button
                key={c.id}
                onClick={() => scrollToCat(c.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  activeCat === c.id
                    ? "text-white shadow-lg"
                    : "border border-white/10 bg-white/[0.03] text-gray-400 hover:bg-white/[0.07] hover:text-gray-200"
                }`}
                style={
                  activeCat === c.id
                    ? {
                        backgroundColor: accent,
                        boxShadow: `0 4px 20px ${hexToRgba(accent, 0.45)}`,
                      }
                    : undefined
                }
              >
                {c.name}{" "}
                <span className={activeCat === c.id ? "text-white/80" : "text-gray-600"}>
                  {catProducts.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="px-4 pb-44">
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
                  className="scroll-mt-20 pt-7"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      className="h-px flex-1"
                      style={{ backgroundColor: hexToRgba(accent, 0.25) }}
                    />
                    <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white">
                      {cat.name}
                    </h2>
                    <span
                      className="h-px flex-1"
                      style={{ backgroundColor: hexToRgba(accent, 0.25) }}
                    />
                  </div>

                  <div className="space-y-3">
                    {catProducts.map((item) => {
                      const inCart = cart.find((ci) => ci.product.id === item.id);
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all ${
                            item.available
                              ? "hover:border-white/[0.14] hover:bg-white/[0.04]"
                              : "opacity-50"
                          }`}
                        >
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="size-16 shrink-0 rounded-xl object-cover"
                            />
                          ) : (
                            <div
                              className="grid size-11 shrink-0 place-items-center rounded-xl border"
                              style={{
                                borderColor: hexToRgba(accent, 0.3),
                                backgroundColor: hexToRgba(accent, 0.08),
                              }}
                            >
                              <UtensilsCrossed className="size-5" style={{ color: accent }} />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-bold text-white">{item.name}</p>
                            {item.description && (
                              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-400">
                                {item.description}
                              </p>
                            )}
                            <p className="mt-1.5 text-sm font-bold" style={{ color: accent }}>
                              {brl(item.price)}
                            </p>
                          </div>

                          {item.available ? (
                            <>
                              {inCart ? (
                                <div
                                  className="flex items-center gap-1.5 rounded-xl border p-1"
                                  style={{
                                    borderColor: hexToRgba(accent, 0.35),
                                    backgroundColor: hexToRgba(accent, 0.12),
                                  }}
                                >
                                  <button
                                    onClick={() => remove(item.id)}
                                    className="grid size-7 place-items-center rounded-lg bg-black/40 text-white transition-colors hover:bg-black/70"
                                    aria-label={`Remover ${item.name}`}
                                  >
                                    <Minus className="size-3.5" />
                                  </button>
                                  <span className="w-5 text-center text-sm font-bold text-white">
                                    {inCart.quantity}
                                  </span>
                                  <button
                                    onClick={() => add(item)}
                                    className="grid size-7 place-items-center rounded-lg transition-colors"
                                    style={{ backgroundColor: accent }}
                                    aria-label={`Adicionar ${item.name}`}
                                  >
                                    <Plus className="size-3.5 text-white" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => add(item)}
                                  className="flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-all"
                                  style={{
                                    borderColor: hexToRgba(accent, 0.45),
                                    color: accent,
                                    backgroundColor: hexToRgba(accent, 0.06),
                                  }}
                                >
                                  <Plus className="size-3.5" /> Adicionar
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                              Indisponível
                            </span>
                          )}
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

      {count > 0 && !cartOpen && !checkoutOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-6 z-30 mx-auto flex max-w-md items-center justify-between rounded-2xl px-5 py-4 text-white transition-transform hover:scale-[1.02]"
          style={{
            backgroundColor: accent,
            boxShadow: `0 8px 30px ${hexToRgba(accent, 0.5)}`,
          }}
        >
          <span className="flex items-center gap-3 text-sm font-bold">
            <span
              className="grid size-6 place-items-center rounded-full text-xs text-black"
              style={{ backgroundColor: "rgba(255,255,255,0.9)" }}
            >
              {count}
            </span>
            Ver pedido
          </span>
          <span className="text-sm font-black">{brl(subtotal)}</span>
        </button>
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
            setCartOpen(false);
            setCheckoutError("");
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
          serverError={checkoutError}
          deliveryFee={Number(restaurant.delivery_fee ?? 0) || 0}
          deliveryRadiusKm={Number(restaurant.delivery_radius_km ?? 0) || 0}
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
            items:
              (currentOrder.items as { product_name: string; quantity: number; total: number }[]) ??
              [],
            observations: currentOrder.observations,
            payment_method: currentOrder.payment_method,
            delivery_type: currentOrder.delivery_type,
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
