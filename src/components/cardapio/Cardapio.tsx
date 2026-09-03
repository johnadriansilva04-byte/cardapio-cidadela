import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ShoppingBag, Plus, Minus, ArrowLeft } from "lucide-react";
import { CidadelaOrb } from "@/components/cidadela/CidadelaOrb";
import { CidadelaUnlockAnimation } from "@/components/cidadela/CidadelaUnlockAnimation";
import { usePlatformStore } from "@/modules/core/store";
import {
  getRestaurantBySlug,
  getOrCreateOwnerId,
} from "@/modules/supabase/restaurants";
import { getMenuWithProducts } from "@/modules/supabase/menu";
import {
  createOrder,
  hasCidadelaAccess,
  unlockCidadela,
} from "@/modules/supabase/orders";
import { brl, newComanda, buildWhatsAppMessage, sendToWhatsApp } from "@/lib/utils";
import type { Product, Category, Restaurant, CartItem, OrderStatus } from "@/lib/types";
import CartSheet from "./CartSheet";
import CheckoutModal from "./CheckoutModal";
import type { CheckoutForm } from "./CheckoutModal";
import SuccessModal from "./SuccessModal";

interface PublicMenuProps {
  slug: string;
}

export default function PublicMenu({ slug }: PublicMenuProps) {
  const {
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    setCart,
  } = usePlatformStore();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState<Record<string, unknown> | null>(null);
  const [showCidadelaUnlock, setShowCidadelaUnlock] = useState(false);
  const [cidadelaUnlocked, setCidadelaUnlocked] = useState(false);
  const [cidadelaPhone, setCidadelaPhone] = useState("");
  const sectionsRef = useRef<Record<string, HTMLElement | null>>({});

  // Load restaurant and menu
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const r = await getRestaurantBySlug(slug);
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

    const orderItems = lines.map((l) => ({
      product_id: l.item.id,
      product_name: l.item.name,
      quantity: l.qty,
      unit_price: l.item.price,
      total: l.item.price * l.qty,
      notes: "",
    }));

    const comanda = newComanda();

    const order = await createOrder(
      restaurant.id,
      {
        comanda,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email,
        delivery_address: form.delivery_address,
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

    // Auto-unlock Cidadela if phone provided
    if (form.customer_phone) {
      setCidadelaPhone(form.customer_phone);
      const unlocked = await unlockCidadela(
        restaurant.id,
        order.id,
        form.customer_phone,
      );
      if (unlocked) {
        setTimeout(() => {
          setShowCidadelaUnlock(true);
          setCidadelaUnlocked(true);
        }, 500);
      }
    }

    clearCart();
    setCheckoutOpen(false);
    setSuccessOrder({
      ...order,
      order_items: orderItems.map((i, idx) => ({ id: `${idx}`, ...i })),
    } as Record<string, unknown>);
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          {restaurant.description || restaurant.name}
        </span>
        <span className="w-5" />
      </div>

      {/* Banner */}
      <div className="relative">
        <div
          className="h-48 w-full bg-cover bg-center bg-no-repeat sm:h-64"
          style={{
            backgroundImage: restaurant.banner_url
              ? `url(${restaurant.banner_url})`
              : `linear-gradient(135deg, ${restaurant.primary_color}33 0%, #000 60%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black" />

        <div className="absolute left-0 right-0 top-4 px-4 text-center">
          {restaurant.logo_url && (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="mx-auto mb-2 size-16 rounded-full border-2 border-white/20 object-cover"
            />
          )}
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            {restaurant.name}
          </h1>
          <p className="mt-1 text-sm text-cyan-300">Qual será o seu pedido?</p>
        </div>

        {/* Cidadela Orb — top right */}
        <div className="absolute right-3 top-3 z-50">
          <CidadelaOrb
            unlocked={cidadelaUnlocked}
            onClick={() => {
              if (cidadelaUnlocked) {
                setShowCidadelaUnlock(true);
              }
            }}
            size="md"
          />
        </div>
      </div>

      {/* Categories sticky bar */}
      <div className="sticky top-0 z-20 border-b border-cyan-500/20 bg-black/90 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {categories.map((c) => {
            const catProducts = products.filter((p) => p.category_id === c.id);
            return (
              <button
                key={c.id}
                onClick={() => scrollToCat(c.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold transition-all ${
                  activeCat === c.id
                    ? "border border-cyan-500 bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]"
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
              (p) => p.category_id === cat.id,
            );
            if (catProducts.length === 0) return null;

            return (
              <section
                key={cat.id}
                ref={(el) => {
                  sectionsRef.current[cat.id] = el;
                }}
                className="scroll-mt-20 pt-6"
              >
                <h2 className="mb-4 text-lg font-bold text-white">
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

      {/* Cidadela unlock animation */}
      <CidadelaUnlockAnimation
        show={showCidadelaUnlock}
        onClose={() => setShowCidadelaUnlock(false)}
      />
    </div>
  );
}
