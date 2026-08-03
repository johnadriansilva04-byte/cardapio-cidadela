import { Copy, Minus, Plus, Settings, ShoppingBag, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { CobraFumando } from "@/components/CobraFumando";
import { PaymentScreen } from "@/components/cardapio/PaymentScreen";
import { useStore } from "@/modules/cidadela-core/store";
import {
  brl,
  buildThermalTicket,
  generatePromoCode,
  newComanda,
} from "@/modules/cidadela-core/utils";
import { buildOrderPayload, sendToN8n } from "@/modules/fluxos-n8n/webhook";
import { supabase } from "@/modules/supabase/client";
import type { Order, OrderItem } from "@/lib/types";

type Cart = Record<string, number>;

export function Cardapio({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const { state, update, online } = useStore();
  const navigate = useNavigate();
  const [cart, setCart] = useState<Cart>({});
  const [activeCat, setActiveCat] = useState(state.categories[0]?.name ?? "");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [success, setSuccess] = useState<Order | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);

  const allItems = useMemo(() => state.categories.flatMap((c) => c.items), [state.categories]);

  const cartItems: OrderItem[] = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => {
          const item = allItems.find((i) => i.id === id);
          if (!item || quantity <= 0) return null;
          return {
            id,
            name: item.name,
            quantity,
            price: item.price,
            total: Number((item.price * quantity).toFixed(2)),
          };
        })
        .filter(Boolean) as OrderItem[],
    [cart, allItems],
  );

  const total = cartItems.reduce((sum, i) => sum + i.total, 0);
  const count = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const remove = (id: string) =>
    setCart((c) => {
      const next = { ...c, [id]: (c[id] ?? 0) - 1 };
      if (next[id] <= 0) delete next[id];
      return next;
    });

  async function submitOrder(order: Order) {
    // Salvar pedido localmente e abrir tela de pagamento
    update((prev) => ({
      ...prev,
      orders: [order, ...prev.orders],
    }));
    setPendingOrder(order);
    setPaymentOpen(true);
    setCart({});
    setCheckoutOpen(false);
    setCartOpen(false);
  }

  async function handlePaymentSuccess() {
    if (!pendingOrder) return;

    // Determinar tipo de acesso baseado no valor total
    const accessType = pendingOrder.total >= 200 ? "15_dias" : "15_min";

    // Gerar código promocional para acesso à Cidadela
    const promoCode = generatePromoCode(undefined, accessType);

    // Salvar código no Supabase
    const expiresAt = new Date(promoCode.expiration);
    const { error: supabaseError } = await supabase
      .from("cidadela_codes")
      .insert({
        code: promoCode.code,
        store_id: state.admin.storeId || state.admin.accessKey,
        customer_phone: pendingOrder.telefone,
        access_type: accessType,
        order_total: pendingOrder.total,
        expires_at: expiresAt.toISOString(),
        is_active: true,
      });

    if (supabaseError) {
      console.error("Erro ao salvar código no Supabase:", supabaseError);
    }

    // Payload completo conforme documentação do N8N com código da Cidadela
    const payloadWithCode = buildOrderPayload(
      pendingOrder,
      promoCode.code,
      accessType,
      state.admin.phone || state.whatsapp,
      state.admin.accessCode,
      state.admin.storeId,
    );

    console.log("ENVIANDO WEBHOOK COMPLETO PARA:", state.integrations.n8nWebhookUrl);
    const synced = await sendToN8n(state.integrations.n8nWebhookUrl, payloadWithCode);
    console.log("RESULTADO WEBHOOK:", synced);

    const finalOrder = { ...pendingOrder, synced };

    // Salvar código localmente para validação
    update((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => o.id === finalOrder.id ? finalOrder : o),
      cidadela: {
        ...prev.cidadela,
        codes: [...prev.cidadela.codes, promoCode],
      },
    }));

    setSuccess(finalOrder);
    setPaymentOpen(false);
    setPendingOrder(null);
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="relative">
        {/* Title Bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <button type="button" onClick={() => navigate({ to: "/" })} className="text-white">
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            className="rounded-lg bg-cyan-500 px-4 py-2 text-[10px] font-semibold text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]"
          >
            Exportar
          </button>
        </div>

        {/* Banner with Profile and Business Info */}
        <div className="relative">
          {/* Cover Photo Banner */}
          <div
            className="h-64 w-full bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: state.store.coverPhoto
                ? `url(${state.store.coverPhoto})`
                : "radial-gradient(ellipse at center top, #e8f4fc 0%, #87ceeb 30%, #4682b4 60%, #1e3a5f 100%)",
            }}
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black" />

          {/* Business Name and Slogan - Moved to Top */}
          <div className="absolute top-4 left-0 right-0 px-4 text-center">
            <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
              {state.store.name}
            </h1>
            <p className="mt-1 text-sm font-medium text-cyan-300">Qual será o seu pedido?</p>
          </div>

          {/* Robot Waiter - Below Name */}
          <div className="absolute left-1/2 top-20 -translate-x-1/2 flex flex-col items-center animate-float">
            <style>
              {`
                @keyframes float {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-10px); }
                }
                .animate-float {
                  animation: float 3s ease-in-out infinite;
                }
                @keyframes eyeColorChange {
                  0%, 100% { fill: #00ffff; }
                  25% { fill: #ff00ff; }
                  50% { fill: #00ff00; }
                  75% { fill: #ffff00; }
                }
                .animate-eye-color {
                  animation: eyeColorChange 4s ease-in-out infinite;
                }
              `}
            </style>
            <svg
              viewBox="0 0 200 240"
              className="size-40"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <defs>
                {/* 3D Rendering Gradients */}
                <radialGradient id="head3D" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#e8f4fc" />
                  <stop offset="100%" stopColor="#1e88e5" />
                </radialGradient>
                <linearGradient id="body3D" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="30%" stopColor="#f0f8ff" />
                  <stop offset="70%" stopColor="#1e88e5" />
                  <stop offset="100%" stopColor="#0d47a1" />
                </linearGradient>
                <linearGradient id="suitGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2c2c2c" />
                  <stop offset="50%" stopColor="#1a1a1a" />
                  <stop offset="100%" stopColor="#0d0d0d" />
                </linearGradient>
                <linearGradient id="shirtGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#f5f5f5" />
                  <stop offset="100%" stopColor="#e0e0e0" />
                </linearGradient>
                <linearGradient id="trayGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c0c0c0" />
                  <stop offset="50%" stopColor="#e8e8e8" />
                  <stop offset="100%" stopColor="#a0a0a0" />
                </linearGradient>
                <linearGradient id="glassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                  <stop offset="50%" stopColor="rgba(200,230,255,0.6)" />
                  <stop offset="100%" stopColor="rgba(150,200,255,0.4)" />
                </linearGradient>
                <linearGradient id="waterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(100,200,255,0.7)" />
                  <stop offset="100%" stopColor="rgba(50,150,255,0.5)" />
                </linearGradient>
                <filter id="shadow3D">
                  <feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.3" />
                </filter>
                <filter id="glow3D">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Robot Head - 3D Sphere */}
              <ellipse
                cx="100"
                cy="45"
                rx="35"
                ry="40"
                fill="url(#head3D)"
                filter="url(#shadow3D)"
              />
              <ellipse cx="100" cy="45" rx="30" ry="35" fill="rgba(0,0,0,0.3)" />

              {/* Face Display - Smiling */}
              <rect
                x="75"
                y="35"
                width="50"
                height="25"
                rx="5"
                fill="rgba(0,0,0,0.8)"
                stroke="#1e88e5"
                strokeWidth="2"
              />

              {/* Eyes - Animated Color LED */}
              <ellipse
                cx="85"
                cy="42"
                rx="6"
                ry="4"
                fill="#00ffff"
                filter="url(#glow3D)"
                className="animate-eye-color"
              />
              <ellipse
                cx="115"
                cy="42"
                rx="6"
                ry="4"
                fill="#00ffff"
                filter="url(#glow3D)"
                className="animate-eye-color"
                style={{ animationDelay: "0.5s" }}
              />
              <circle cx="85" cy="42" r="2" fill="#ffffff" />
              <circle cx="115" cy="42" r="2" fill="#ffffff" />

              {/* Smile */}
              <path
                d="M85 52 Q100 60 115 52"
                stroke="#00ffff"
                strokeWidth="2"
                fill="none"
                filter="url(#glow3D)"
              />

              {/* Neck */}
              <rect
                x="90"
                y="82"
                width="20"
                height="12"
                fill="url(#body3D)"
                filter="url(#shadow3D)"
              />

              {/* Body - White/Blue 3D */}
              <path
                d="M70 95 L130 95 L135 170 L65 170 Z"
                fill="url(#body3D)"
                filter="url(#shadow3D)"
              />

              {/* Suit Jacket */}
              <path d="M70 95 L130 95 L135 170 L65 170 Z" fill="url(#suitGradient)" opacity="0.9" />
              <path d="M75 100 L125 100 L130 165 L70 165 Z" fill="url(#suitGradient)" />

              {/* Vest */}
              <path d="M85 105 L115 105 L118 160 L82 160 Z" fill="url(#suitGradient)" />

              {/* White Shirt */}
              <path d="M90 110 L110 110 L112 155 L88 155 Z" fill="url(#shirtGradient)" />

              {/* Bow Tie */}
              <polygon points="100,105 92,115 100,125 108,115" fill="#000000" />
              <circle cx="100" cy="115" r="2" fill="#1e88e5" />

              {/* Arms */}
              {/* Left Arm - Behind Back */}
              <path
                d="M65 100 Q45 120 40 150"
                stroke="url(#suitGradient)"
                strokeWidth="12"
                fill="none"
                filter="url(#shadow3D)"
              />
              <circle cx="40" cy="150" r="8" fill="url(#body3D)" />

              {/* Right Arm - With Towel */}
              <path
                d="M135 100 Q155 120 160 150"
                stroke="url(#suitGradient)"
                strokeWidth="12"
                fill="none"
                filter="url(#shadow3D)"
              />
              <circle cx="160" cy="150" r="8" fill="url(#body3D)" />

              {/* Service Towel on Right Arm */}
              <rect
                x="155"
                y="130"
                width="15"
                height="25"
                rx="2"
                fill="#ffffff"
                stroke="#e0e0e0"
                strokeWidth="1"
              />
              <line x1="158" y1="135" x2="158" y2="150" stroke="#e0e0e0" strokeWidth="1" />
              <line x1="162" y1="135" x2="162" y2="150" stroke="#e0e0e0" strokeWidth="1" />
              <line x1="166" y1="135" x2="166" y2="150" stroke="#e0e0e0" strokeWidth="1" />

              {/* Tray in Right Hand */}
              <ellipse
                cx="165"
                cy="145"
                rx="35"
                ry="12"
                fill="url(#trayGradient)"
                filter="url(#shadow3D)"
                stroke="#a0a0a0"
                strokeWidth="2"
              />

              {/* Napkin on Tray */}
              <rect
                x="140"
                y="138"
                width="20"
                height="15"
                rx="1"
                fill="#ffffff"
                stroke="#e0e0e0"
                strokeWidth="1"
              />
              <line x1="145" y1="142" x2="155" y2="142" stroke="#e0e0e0" strokeWidth="0.5" />
              <line x1="145" y1="146" x2="155" y2="146" stroke="#e0e0e0" strokeWidth="0.5" />
              <line x1="145" y1="150" x2="155" y2="150" stroke="#e0e0e0" strokeWidth="0.5" />

              {/* Three Water Glasses */}
              <rect
                x="165"
                y="130"
                width="8"
                height="12"
                rx="1"
                fill="url(#glassGradient)"
                stroke="#a0a0a0"
                strokeWidth="1"
              />
              <rect x="166" y="132" width="6" height="8" fill="url(#waterGradient)" />

              <rect
                x="175"
                y="130"
                width="8"
                height="12"
                rx="1"
                fill="url(#glassGradient)"
                stroke="#a0a0a0"
                strokeWidth="1"
              />
              <rect x="176" y="132" width="6" height="8" fill="url(#waterGradient)" />
              {/* Lemon slice */}
              <circle cx="180" cy="135" r="2" fill="#ffeb3b" stroke="#ffc107" strokeWidth="0.5" />

              <rect
                x="185"
                y="130"
                width="8"
                height="12"
                rx="1"
                fill="url(#glassGradient)"
                stroke="#a0a0a0"
                strokeWidth="1"
              />
              <rect x="186" y="132" width="6" height="8" fill="url(#waterGradient)" />

              {/* Legs - Black Pants */}
              <path
                d="M75 170 L70 230"
                stroke="url(#suitGradient)"
                strokeWidth="14"
                fill="none"
                filter="url(#shadow3D)"
              />
              <path
                d="M125 170 L130 230"
                stroke="url(#suitGradient)"
                strokeWidth="14"
                fill="none"
                filter="url(#shadow3D)"
              />

              {/* Feet - Parallel */}
              <ellipse cx="70" cy="232" rx="10" ry="5" fill="#0d0d0d" filter="url(#shadow3D)" />
              <ellipse cx="130" cy="232" rx="10" ry="5" fill="#0d0d0d" filter="url(#shadow3D)" />
            </svg>
          </div>

          {/* Cidadela Connection Element */}
          <button
            type="button"
            onClick={() => navigate({ to: "/cidadela" })}
            className="absolute right-4 top-16 z-50 transition-all hover:scale-105 active:scale-95"
          >
            <div className="relative size-20 flex flex-col items-center justify-center rounded-full border-2 border-cyan-400 bg-black/70 shadow-[0_0_30px_rgba(34,211,238,0.7)]">
              <div className="absolute inset-0 animate-pulse rounded-full bg-cyan-400/60" />
              <span className="relative text-[10px] font-bold text-cyan-300 tracking-tight leading-tight">
                CONHEÇA A CIDADELA
              </span>
              <svg
                viewBox="0 0 24 24"
                className="relative size-7 text-yellow-400 mt-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </div>
          </button>
        </div>
      </header>

      {/* Category Navigation */}
      <nav className="sticky top-0 z-20 border-b border-red-500/20 bg-black/90 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {state.categories.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => {
                setActiveCat(cat.name);
                document
                  .getElementById(`cat-${cat.name}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold transition-all ${
                activeCat === cat.name
                  ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-500"
                  : "bg-black/50 text-gray-400 hover:bg-red-500/10 border border-red-500/30"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </nav>

      <main className="px-4 pb-24">
        <div className="mx-auto max-w-xl">
          {state.categories.map((cat) => (
            <section key={cat.name} id={`cat-${cat.name}`} className="scroll-mt-20 pt-6">
              <h2 className="mb-4 text-lg font-bold text-white">{cat.name}</h2>
              <div className="space-y-4">
                {cat.items.map((item) => (
                  <article
                    key={item.id}
                    className="group relative flex items-center gap-4 rounded-xl border border-red-500/20 bg-black/40 p-4 transition-all hover:border-red-500/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                  >
                    {/* Dish Image - Circular with red circuit border */}
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 animate-pulse rounded-full border border-red-500/30" />
                      <div className="relative size-16 overflow-hidden rounded-full border-2 border-red-500/50 bg-black/50">
                        <div className="flex size-full items-center justify-center text-2xl">
                          {item.img}
                        </div>
                      </div>
                    </div>

                    {/* Name and Description */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-white group-hover:text-red-400 transition-colors">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-xs text-gray-400 line-clamp-2">{item.desc}</p>
                    </div>

                    {/* Price and Add Button */}
                    <div className="flex shrink-0 flex-col items-end gap-2 min-w-[80px]">
                      <p className="text-sm font-bold text-white">{brl(item.price)}</p>
                      {cart[item.id] ? (
                        <div className="flex items-center gap-2 rounded-lg bg-red-500/20 border border-red-500/30 p-1">
                          <button
                            type="button"
                            aria-label={`Remover ${item.name}`}
                            onClick={() => remove(item.id)}
                            className="grid size-6 place-items-center rounded-full bg-black/50 hover:bg-black/70"
                          >
                            <Minus className="size-3 text-red-400" />
                          </button>
                          <span className="w-4 text-center text-sm font-semibold text-white">
                            {cart[item.id]}
                          </span>
                          <button
                            type="button"
                            aria-label={`Adicionar ${item.name}`}
                            onClick={() => add(item.id)}
                            className="grid size-6 place-items-center rounded-full bg-red-600 hover:bg-red-500"
                          >
                            <Plus className="size-3 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => add(item.id)}
                          className="flex items-center gap-1 rounded-lg border border-red-500/50 bg-black/50 px-3 py-1.5 text-[10px] font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                        >
                          <Plus className="size-3" />
                          ADD
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-red-500/20 bg-black/95 backdrop-blur">
        <div className="flex items-center justify-around py-3">
          <button type="button" className="flex flex-col items-center gap-1 transition-all">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse" />
              <svg
                viewBox="0 0 24 24"
                className="relative size-6 text-red-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </div>
            <span className="text-[10px] font-semibold text-red-500">CARDÁPIO</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 transition-all hover:text-gray-300"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-6 text-gray-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="text-[10px] font-semibold text-gray-500">PERFIL</span>
          </button>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="flex flex-col items-center gap-1 transition-all hover:text-gray-300"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-6 text-gray-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-[10px] font-semibold text-gray-500">PAINEL</span>
          </button>
        </div>
      </nav>

      {count > 0 && !cartOpen && !checkoutOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-20 z-30 mx-auto flex max-w-md items-center justify-between rounded-full bg-red-600 px-5 py-4 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="size-4" /> {count} {count === 1 ? "item" : "itens"}
          </span>
          <span className="text-sm font-bold">{brl(total)}</span>
        </button>
      )}

      {cartOpen && (
        <CartSheet
          items={cartItems}
          total={total}
          onClose={() => setCartOpen(false)}
          onAdd={add}
          onRemove={remove}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />
      )}

      {checkoutOpen && (
        <CheckoutModal
          items={cartItems}
          subtotal={total}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={submitOrder}
        />
      )}

      {success && <SuccessModal order={success} onClose={() => setSuccess(null)} />}
    </div>
  );
}

function CartSheet({
  items,
  total,
  onClose,
  onAdd,
  onRemove,
  onCheckout,
}: {
  items: OrderItem[];
  total: number;
  onClose: () => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <div className="w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Seu pedido</h2>
          <button type="button" onClick={onClose} aria-label="Fechar carrinho">
            <X className="size-5" />
          </button>
        </div>
        <ul className="mt-4 space-y-3">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 text-sm">
              <div className="flex-1">
                <p className="font-medium">{i.name}</p>
                <p className="text-xs text-muted-foreground">{brl(i.price)} un.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Remover" onClick={() => onRemove(i.id)}>
                  {i.quantity === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                </button>
                <span className="w-4 text-center font-semibold">{i.quantity}</span>
                <button type="button" aria-label="Adicionar" onClick={() => onAdd(i.id)}>
                  <Plus className="size-4" />
                </button>
              </div>
              <span className="w-20 text-right font-semibold">{brl(i.total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-bold">{brl(total)}</span>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          className="ember-glow mt-4 w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground"
        >
          Finalizar pedido
        </button>
      </div>
    </div>
  );
}

function CheckoutModal({
  items,
  subtotal,
  onClose,
  onConfirm,
}: {
  items: OrderItem[];
  subtotal: number;
  onClose: () => void;
  onConfirm: (order: Order) => void | Promise<void>;
}) {
  const { state } = useStore();
  const [form, setForm] = useState({
    cliente: "",
    telefone: "",
    rua: "",
    numero: "",
    bairro: "",
    referencia: "",
    observacoes: "",
    troco: "",
  });
  const [tipo, setTipo] = useState<"entrega" | "retirada">("entrega");
  const [pagamento, setPagamento] = useState<"pix" | "dinheiro" | "cartao">("pix");
  const [sending, setSending] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);

  const taxa = tipo === "entrega" ? 0 : 0;
  const total = Number((subtotal + taxa).toFixed(2));
  const pixQr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(state.payment.pixKey)}`;

  const valid =
    form.cliente.trim().length > 1 &&
    form.telefone.trim().length >= 8 &&
    (tipo === "retirada" ||
      (form.rua.trim().length > 2 &&
        form.numero.trim().length > 0 &&
        form.bairro.trim().length > 2));

  function copyPixKey() {
    navigator.clipboard.writeText(state.payment.pixKey);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || sending) return;
    setSending(true);
    await onConfirm({
      comanda: newComanda(),
      cliente: form.cliente.trim(),
      telefone: form.telefone.trim(),
      endereco:
        tipo === "entrega"
          ? `${form.rua.trim()}, ${form.numero.trim()} - ${form.bairro.trim()}${form.referencia.trim() ? ` (Ref: ${form.referencia.trim()})` : ""}`
          : "Retirada no balcão",
      observacoes: form.observacoes.trim(),
      itens: items,
      total,
      tipo_entrega: tipo,
      taxa_entrega: taxa,
      pagamento,
      troco: pagamento === "dinheiro" ? form.troco : undefined,
      status: "pendente",
      createdAt: new Date().toISOString(),
      synced: false,
    });
    setSending(false);
  }

  const field =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/60 p-0 sm:p-6">
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Checkout</h2>
          <button type="button" onClick={onClose} aria-label="Fechar checkout">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["entrega", "retirada"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`text-tech rounded-lg px-3 py-2 text-[11px] ${
                tipo === t ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <input
            className={field}
            placeholder="Seu nome"
            value={form.cliente}
            onChange={(e) => setForm({ ...form, cliente: e.target.value })}
          />
          <input
            className={field}
            placeholder="Telefone / WhatsApp"
            inputMode="tel"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
          />
          {tipo === "entrega" && (
            <div className="space-y-3">
              <input
                className={field}
                placeholder="Rua"
                value={form.rua}
                onChange={(e) => setForm({ ...form, rua: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  className={field}
                  placeholder="Número"
                  value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                />
                <input
                  className={`${field} col-span-2`}
                  placeholder="Bairro"
                  value={form.bairro}
                  onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                />
              </div>
              <input
                className={field}
                placeholder="Ponto de referência (opcional)"
                value={form.referencia}
                onChange={(e) => setForm({ ...form, referencia: e.target.value })}
              />
            </div>
          )}
          <textarea
            className={field}
            rows={2}
            placeholder="Observações (ex: sem cebola)"
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {(["pix", "dinheiro", "cartao"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPagamento(p)}
              className={`text-tech rounded-lg px-2 py-2 text-[11px] ${
                pagamento === p ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {pagamento === "pix" && (
          <div className="mt-4 flex items-center gap-4 rounded-xl bg-secondary p-4">
            <img
              src={pixQr}
              alt="QR Code PIX para pagamento"
              width={90}
              height={90}
              className="rounded-md"
            />
            <div className="flex-1 text-xs">
              <p className="font-semibold">Chave PIX</p>
              <p className="break-all text-muted-foreground">{state.payment.pixKey}</p>
              <button
                type="button"
                onClick={copyPixKey}
                className="mt-2 flex items-center gap-1 text-primary hover:underline"
              >
                <Copy className="size-3" />
                {copiedPix ? "Copiado!" : "Copiar chave"}
              </button>
            </div>
          </div>
        )}

        {pagamento === "dinheiro" && (
          <input
            className={`${field} mt-4`}
            placeholder="Troco para quanto?"
            inputMode="numeric"
            value={form.troco}
            onChange={(e) => setForm({ ...form, troco: e.target.value })}
          />
        )}

        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-bold">{brl(total)}</span>
        </div>

        <button
          type="submit"
          disabled={!valid || sending}
          className="ember-glow mt-4 w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {sending ? "Enviando..." : "Confirmar pedido"}
        </button>
      </form>
    </div>
  );

  if (paymentOpen && pendingOrder) {
    return (
      <PaymentScreen
        order={pendingOrder}
        onSuccess={handlePaymentSuccess}
        onCancel={() => {
          setPaymentOpen(false);
          setPendingOrder(null);
        }}
      />
    );
  }
}

function SuccessModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { state } = useStore();
  // Format WhatsApp message for thermal printer (Comanda format)
  const formatComandaMessage = (order: Order): string => {
    const itemsText = order.itens
      .map((item) => {
        let text = `- ${item.quantity}x ${item.name} (${brl(item.total)})`;
        if (order.observacoes) {
          text += `\n  _Obs: ${order.observacoes}_`;
        }
        return text;
      })
      .join("\n");

    const paymentText =
      order.pagamento === "dinheiro"
        ? `Dinheiro (Troco p/ R$ ${order.troco || "0"})`
        : order.pagamento === "cartao"
          ? "Cartão"
          : "PIX";

    const addressText =
      order.tipo_entrega === "entrega" ? `${order.endereco}` : "Retirada no balcão";

    return `==============================
   *NOVO PEDIDO - ${state.store.name}*
==============================
*Cliente:* ${order.cliente}
*Telefone:* ${order.telefone}
*Tipo:* ${order.tipo_entrega === "entrega" ? "Delivery" : "Retirada"}
*Endereço:* ${addressText}

------------------------------
*ITENS DO PEDIDO:*
${itemsText}
------------------------------

*FORMA DE PAGAMENTO:* ${paymentText}
*TAXA DE ENTREGA:* ${brl(order.taxa_entrega)}
*TOTAL DO PEDIDO:* ${brl(order.total)}
==============================`;
  };

  const waText = encodeURIComponent(formatComandaMessage(order));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5">
      <div className="feb-scope w-full max-w-sm rounded-2xl border border-border p-6 text-center">
        <CobraFumando className="mx-auto size-14 text-[color:var(--brass)]" />
        <p className="text-tech mt-4 text-[10px] text-[color:var(--brass)]">Pedido confirmado</p>
        <h2 className="text-stencil mt-1 text-2xl">{order.comanda}</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {order.synced
            ? "Comanda transmitida ao comando. Confirmação chega no WhatsApp."
            : "Comanda registrada localmente e será transmitida assim que a conexão voltar."}
        </p>
        <p className="mt-4 text-xs italic text-muted-foreground/80">
          “Tudo quanto te vier à mão para fazer, faze-o conforme as tuas forças.” — Eclesiastes 9:10
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <a
            href={`https://wa.me/${state.whatsapp}?text=${waText}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
          >
            Finalizar Pedido no WhatsApp
          </a>
          <button type="button" onClick={onClose} className="text-tech py-2 text-[11px]">
            Voltar ao cardápio
          </button>
        </div>
        <p className="text-tech mt-4 text-[9px] text-muted-foreground/60">
          {buildThermalTicket(order, state.store.name).split("\n").length} linhas de comanda prontas
        </p>
      </div>
    </div>
  );
}
