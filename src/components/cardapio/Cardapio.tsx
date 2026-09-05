import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ShoppingBag, Plus, Minus, ArrowLeft } from "lucide-react";
import { usePlatformStore } from "@/modules/core/store";
import {
  getRestaurantBySlug,
} from "@/modules/supabase/restaurants";
import { getMenuWithProducts } from "@/modules/supabase/menu";
import { supabase } from "@/modules/supabase/client";
import {
  createOrder,
} from "@/modules/supabase/orders";
import { useAuth } from "@/components/AuthProvider";
import { brl, newComanda } from "@/lib/utils";
import type { Product, Category, Restaurant, CartItem, OrderStatus } from "@/lib/types";
import CartSheet from "./CartSheet";
import CheckoutModal from "./CheckoutModal";
import type { CheckoutForm } from "./CheckoutModal";
import SuccessModal from "./SuccessModal";

interface PublicMenuProps {
  slug: string;
}

async function ensureRestaurantFromLegacyTrial(slug: string): Promise<Restaurant | null> {
  if (!slug) return null;

  // Trials antigos usavam store_id como slug público. Materializa restaurante real sob demanda (idempotente).

  const { data: trial } = await supabase
    .from("admin_trials")
    .select("store_id, store_name, store_slogan, pix_key, whatsapp")
    .eq("store_id", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!trial) return null;

  // Race guard: outra request pode ter criado entrementempo.

  const existing = await getRestaurantBySlug(slug);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("restaurants")
    .insert({
      owner_id: trial.store_id,
      name: trial.store_name ?? "Meu Restaurante",
      slug: trial.store_id,
      description: trial.store_slogan ?? "",
      slogan: trial.store_slogan ?? "",
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
  const {
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    setCart,
  } = usePlatformStore();

  const { user, isAuthenticated } = useAuth();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const sectionsRef = useRef<Record<string, HTMLElement | null>>({});

  // Load restaurant and menu
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      let r = await getRestaurantBySlug(slug);
      if (!r) r = await ensureRestaurantFromLegacyTrial(slug);
      if (!alive) return;
      if (!r) {
        setLoading(false);
        return;
      }
      setRestaurant(r);
      const { categories: cats, products: prods } = await getMenuWithProducts(r.id);
      if (!alive) return;
      setCategories(cats);
      setProducts(prods);
      if (cats.length > 0) setActiveCat(cats[0].id);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [slug]);

  // Clear cart when restaurant changes
  useEffect(() => {
    setCart([]);
  }, [slug, setCart]);

  // Em tempo real: o cardapio recarrega automaticamente quando o admin salva no Supabase.
  useEffect(() => {
    if (!restaurant) return;

    const restaurantId = restaurant.id;

    async function refreshMenu() {
      const { categories: cats, products: prods } = await getMenuWithProducts(
        restaurantId,
      );
      setCategories(cats);
      setProducts(prods);
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
        async () => {
          const r = await getRestaurantBySlug(slug);
          if (r) setRestaurant(r);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id]);
  // Polling leve de garantia (10s): mantém o cardápio atualizado mesmo sem Realtime no banco.
  // E faz o cardápio reaparecer sozinho quando o dono publicar/pausar um restaurante.

  useEffect(() => {
    let alive = true;

    async function refreshAll() {
      const r = await getRestaurantBySlug(slug);
      if (!alive) return;
      if (!r) {
        setRestaurant(null);
        return;
      }
      const { categories: cats, products: prods } = await getMenuWithProducts(
        r.id,
      );
      if (!alive) return;
      setRestaurant(r);
      setCategories(cats);
      setProducts(prods);
    }

    const interval = setInterval(refreshAll, 10_000);
    refreshAll();

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [slug]);

  const allItems = useMemo(
    () => products,
    [products],
  );

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
    // Hard guard: ignore any further submits while one is already being processed.
    // (Covers double/triple-clicksz including clicks during the in-flight request.)
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
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

      const order = await createOrder(
        restaurant.id,
        {
          comanda,
          customer_id: user?.id ?? null,
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
          delivery_fee: 0,
          total: subtotal,
          payment_method: form.payment_method,
        },
        orderItems,
      );

      if (!order) {
        alert("Erro ao criar pedido. Tente novamente.");
        return;
      }

      clearCart();
      setCheckoutOpen(false);
      setSuccessOrder({
        ...order,
        items: orderItems.map((i, idx) => ({ id: `${idx}`, ...i })),
      } as Record<string, unknown>);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-400">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  // Restaurant not found
  if (!restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center px-6">
          <p className="text-6xl mb-4">🍽️</p>
          <h1 className="text-xl font-bold text-white">Restaurante não encontrado</h1>
          <p className="mt-2 text-sm text-gray-400">
            O cardápio que você procura não existe ou está indisponível.
          </p>
        </div>
      </div>
    );
  }

  // Paused status
  if (restaurant.status === "paused") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center px-6">
          <p className="text-6xl mb-4">⏸️</p>
          <h1 className="text-xl font-bold text-white">{restaurant.name}</h1>
          <p className="mt-2 text-sm text-gray-400">
            Cardápio temporariamente indisponível.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Tente novamente mais tarde.
          </p>
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
    order_items?: { product_name: string; quantity: number; total: number }[];
    observations: string;
    payment_method: string;
    delivery_type: string;
    delivery_address: string;
  } | null;

  return (
    <div className="min-h-screen bg-black">
      {/* Header with visual identity */}
      <div className="relative">
        {/* Banner background */}
        <div
          className="h-56 w-full bg-cover bg-center bg-no-repeat sm:h-72"
          style={{
            backgroundImage: restaurant.banner_url
              ? `url(${restaurant.banner_url})`
              : `linear-gradient(135deg, ${restaurant.primary_color}33 0%, #000 60%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black" />

        {/* Restaurant identity — centered */}
        <div className="absolute left-0 right-0 top-8 px-4 text-center sm:top-12">
          {/* Logo / Cover image */}
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="mx-auto mb-3 size-20 rounded-2xl border-2 border-white/20 object-cover shadow-[0_0_30px_rgba(0,0,0,0.5)] sm:size-24"
            />
          ) : (
            <div className="mx-auto mb-3 flex size-20 items-center justify-center rounded-2xl border-2 border-cyan-500/30 bg-black/60 shadow-[0_0_30px_rgba(0,0,0,0.5)] sm:size-24">
              <span className="text-3xl">🍽️</span>
            </div>
          )}

          {/* Restaurant name */}
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            {restaurant.name}
          </h1>

          {/* Slogan */}
          {restaurant.slogan && (
            <p className="mt-1.5 text-sm italic text-cyan-300/80">
              "{restaurant.slogan}"
            </p>
          )}
        </div>

        {/* Botão da Cidadela */}
        <a
          href="http://localhost:3001"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-4 top-16 z-50 size-24 transition-transform hover:scale-105 active:scale-95"
          aria-label="Conheça a Cidadela"
        >
          <span className="absolute inset-0 animate-pulse rounded-full bg-cyan-400/60" />
          <span className="relative flex size-24 flex-col items-center justify-center rounded-full border-2 border-cyan-400 bg-black/70 shadow-[0_0_30px_rgba(34,211,238,0.7)]">
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 size-full"
            >
              <defs>
                <path
                  id="textPath"
                  d="M 10,55 A 40,40 0 0,1 90,55"
                  fill="none"
                />
              </defs>
              <text
                fill="#67e8f9"
                fontSize="8"
                fontWeight="900"
                letterSpacing="0.5"
                className="font-sans animate-pulse"
              >
                <textPath href="#textPath" startOffset="50%" textAnchor="middle">
                  CONHEÇA A CIDADELA
                </textPath>
              </text>
            </svg>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="mt-8 size-8 text-yellow-400 animate-pulse"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
        </a>
      </div>

      {/* Categories sticky bar */}
      <div className="sticky top-0 z-20 border-b border-cyan-500/20 bg-black/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2 overflow-x-auto px-4 py-2">
          {categories.map((c) => {
            const catProducts = products.filter((p) => p.category_id === c.id && p.available);
            return (
              <button
                key={c.id}
                onClick={() => scrollToCat(c.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all ${
                  activeCat === c.id
                    ? "border border-cyan-500 bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                    : "border border-cyan-500/30 bg-black/50 text-gray-400 hover:bg-cyan-500/10"
                }`}
              >
                {c.name} ({catProducts.length})
              </button>
            );
          })}
        </div>
      </div>

      {/* Products */}
      <main className="px-4 pb-40">
        <div className="mx-auto max-w-xl">
          {categories.map((cat) => {
            const catProducts = products.filter(
              (p) => p.category_id === cat.id && p.available,
            );
            if (catProducts.length === 0) return null;

            return (
              <section
                key={cat.id}
                ref={(el) => {
                  sectionsRef.current[cat.id] = el;
                }}
                className="scroll-mt-16 pt-5"
              >
                <h2 className="mb-3 text-base font-bold text-white uppercase tracking-wide">
                  {cat.name}
                </h2>
                <div className="space-y-3">
                  {catProducts.map((item) => {
                    const inCart = cart.find(
                      (ci) => ci.product.id === item.id,
                    );
                    return (
                      <div
                        key={item.id}
                        className={`group relative flex items-center gap-4 rounded-xl border p-4 transition-all ${
                          item.available
                            ? "border-cyan-500/20 bg-black/40 hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                            : "border-gray-800/50 bg-black/20 opacity-50"
                        }`}
                      >
                        {/* Product image or indicator */}
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="size-14 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="size-3 shrink-0 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-base font-bold text-white transition-colors group-hover:text-cyan-400">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-gray-400">
                              {item.description}
                            </p>
                          )}
                          <p className="mt-1 text-sm font-bold text-cyan-400">
                            {brl(item.price)}
                          </p>
                        </div>

                        {item.available && (
                          <>
                            {inCart ? (
                              <div className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/20 p-1">
                                <button
                                  onClick={() => remove(item.id)}
                                  className="grid size-6 place-items-center rounded-full bg-black/50 hover:bg-black/70"
                                  aria-label={`Remover ${item.name}`}
                                >
                                  <Minus className="size-3 text-white" />
                                </button>
                                <span className="w-4 text-center text-xs font-bold text-white">
                                  {inCart.quantity}
                                </span>
                                <button
                                  onClick={() => add(item)}
                                  className="grid size-6 place-items-center rounded-full bg-cyan-600 hover:bg-cyan-500"
                                  aria-label={`Adicionar ${item.name}`}
                                >
                                  <Plus className="size-3 text-white" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => add(item)}
                                className="flex items-center gap-1 rounded-lg border border-cyan-500/50 bg-black/50 px-3 py-1.5 text-[10px] font-semibold text-cyan-400 transition-all hover:bg-cyan-500/20 hover:shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                              >
                                <Plus className="size-3" /> ADD
                              </button>
                            )}
                          </>
                        )}

                        {!item.available && (
                          <span className="text-[10px] font-semibold text-gray-500">
                            INDISPONÍVEL
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {/* Floating cart button */}
      {count > 0 && !cartOpen && !checkoutOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-md items-center justify-between rounded-full bg-cyan-600 px-5 py-4 text-white shadow-[0_0_20px_rgba(6,182,212,0.5)]"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="size-4" /> {count}{" "}
            {count === 1 ? "item" : "itens"}
          </span>
          <span className="text-sm font-bold">{brl(subtotal)}</span>
        </button>
      )}

      {/* Cart sheet */}
      {cartOpen && (
        <CartSheet
          lines={lines}
          subtotal={subtotal}
          onInc={(id) => {
            const product = products.find((p) => p.id === id);
            if (product) add(product);
          }}
          onDec={remove}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />
      )}

      {/* Checkout modal */}
      {checkoutOpen && (
        <CheckoutModal
          total={subtotal}
          prefillName={user?.user_metadata?.name || ""}
          prefillPhone={user?.user_metadata?.phone || ""}
          submitting={submitting}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={handleCheckout}
        />
      )}

      {/* Success modal */}
      {currentOrder && (
        <SuccessModal
          order={{
            id: currentOrder.id,
            comanda: currentOrder.comanda,
            total: currentOrder.total,
            customer_name: currentOrder.customer_name,
            customer_phone: currentOrder.customer_phone,
            items: currentOrder.order_items ?? [],
            observations: currentOrder.observations,
            payment_method: currentOrder.payment_method,
            delivery_type: currentOrder.delivery_type,
          }}
          restaurantSlug={slug}
          restaurantName={restaurant.name}
          restaurantWhatsapp={restaurant.whatsapp}
          onClose={() => setSuccessOrder(null)}
        />
      )}
    </div>
  );
}
