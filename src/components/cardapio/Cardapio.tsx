import { Copy, Minus, Plus, Settings, ShoppingBag, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { CobraFumando } from "@/components/CobraFumando";
import { useStore } from "@/modules/cidadela-core/store";
import {
  brl,
  buildThermalTicket,
  generatePromoCode,
  newComanda,
} from "@/modules/cidadela-core/utils";
import { buildOrderPayload, sendToN8n } from "@/modules/fluxos-n8n/webhook";
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
    // Determinar tipo de acesso baseado no valor total
    const accessType = order.total >= 200 ? "15_dias" : "15_min";

    // Gerar código promocional para acesso à Cidadela
    const promoCode = generatePromoCode(
      accessType === "15_dias" ? "FEB-VIP" : "FEB-ACESSO",
      accessType,
    );

    // Adicionar código ao payload para envio via WhatsApp
    const payloadWithCode = {
      ...buildOrderPayload(order),
      cidadela_code: promoCode.code,
      cidadela_access_type: accessType,
    };

    const synced = await sendToN8n(state.integrations.n8nWebhookUrl, payloadWithCode);
    const finalOrder = { ...order, synced };

    // Salvar código localmente para validação
    update((prev) => ({
      ...prev,
      orders: [finalOrder, ...prev.orders],
      cidadela: {
        ...prev.cidadela,
        codes: [...prev.cidadela.codes, promoCode],
      },
    }));

    setSuccess(finalOrder);
    setCart({});
    setCheckoutOpen(false);
    setCartOpen(false);
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
                : "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
            }}
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black" />

          {/* Robot Waiter - Centered */}
          <div className="absolute left-1/2 top-4 -translate-x-1/2 flex flex-col items-center animate-float">
            <style>
              {`
                @keyframes float {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-10px); }
                }
                .animate-float {
                  animation: float 3s ease-in-out infinite;
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
                <linearGradient id="metalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4a5568" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#718096" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#4a5568" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="cyanGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity="0.7" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Robot Head - Detailed */}
              <ellipse
                cx="100"
                cy="50"
                rx="45"
                ry="40"
                className="stroke-gray-400"
                fill="url(#metalGradient)"
              />
              <ellipse
                cx="100"
                cy="50"
                rx="38"
                ry="33"
                className="stroke-cyan-400"
                fill="rgba(15,23,42,0.8)"
              />

              {/* Eyes - Glowing */}
              <ellipse
                cx="85"
                cy="45"
                rx="12"
                ry="8"
                className="stroke-cyan-400"
                fill="url(#cyanGlow)"
                filter="url(#glow)"
              />
              <ellipse
                cx="115"
                cy="45"
                rx="12"
                ry="8"
                className="stroke-cyan-400"
                fill="url(#cyanGlow)"
                filter="url(#glow)"
              />
              <circle cx="85" cy="45" r="3" className="fill-white" />
              <circle cx="115" cy="45" r="3" className="fill-white" />

              {/* Mouth - Digital Display */}
              <rect
                x="85"
                y="60"
                width="30"
                height="8"
                rx="2"
                className="stroke-red-400"
                fill="rgba(239,68,68,0.3)"
              />
              <rect
                x="87"
                y="62"
                width="8"
                height="4"
                rx="1"
                className="fill-red-400 animate-pulse"
              />
              <rect
                x="97"
                y="62"
                width="8"
                height="4"
                rx="1"
                className="fill-red-400 animate-pulse"
                style={{ animationDelay: "0.2s" }}
              />
              <rect
                x="107"
                y="62"
                width="8"
                height="4"
                rx="1"
                className="fill-red-400 animate-pulse"
                style={{ animationDelay: "0.4s" }}
              />

              {/* Antenna */}
              <line
                x1="100"
                y1="10"
                x2="100"
                y2="0"
                className="stroke-yellow-400"
                strokeWidth="2"
              />
              <circle
                cx="100"
                cy="0"
                r="5"
                className="stroke-yellow-400 fill-yellow-400/30 animate-pulse"
                filter="url(#glow)"
              />

              {/* Neck */}
              <rect
                x="90"
                y="88"
                width="20"
                height="12"
                rx="3"
                className="stroke-gray-500"
                fill="url(#metalGradient)"
              />

              {/* Body - Waiter Suit */}
              <path
                d="M60 100 L140 100 L145 180 L55 180 Z"
                className="stroke-gray-300"
                fill="url(#metalGradient)"
              />
              <path
                d="M65 105 L135 105 L140 175 L60 175 Z"
                className="stroke-gray-400"
                fill="rgba(30,41,59,0.5)"
              />

              {/* Bow Tie */}
              <polygon
                points="100,100 90,110 100,120 110,110"
                className="stroke-red-500 fill-red-500/40"
              />
              <circle cx="100" cy="110" r="3" className="stroke-red-600 fill-red-600" />

              {/* Arms - Detailed with joints */}
              <path
                d="M60 110 Q40 130 35 160"
                className="stroke-gray-400"
                fill="none"
                strokeWidth="3"
              />
              <path
                d="M140 110 Q160 130 165 160"
                className="stroke-gray-400"
                fill="none"
                strokeWidth="3"
              />
              <circle cx="35" cy="160" r="8" className="stroke-gray-500 fill-gray-500/30" />
              <circle cx="165" cy="160" r="8" className="stroke-gray-500 fill-gray-500/30" />

              {/* Tray - Detailed */}
              <ellipse
                cx="165"
                cy="155"
                rx="35"
                ry="12"
                className="stroke-yellow-400 fill-yellow-400/20"
                strokeWidth="2"
              />
              <ellipse
                cx="165"
                cy="152"
                rx="30"
                ry="8"
                className="stroke-yellow-300 fill-yellow-300/10"
              />

              {/* Text on Tray */}
              <text
                x="165"
                y="154"
                textAnchor="middle"
                className="fill-cyan-300 font-bold tracking-tight"
                style={{ fontSize: "6px" }}
              >
                Posso anotar o seu pedido?
              </text>

              {/* Legs - Detailed */}
              <path d="M75 180 L70 230" className="stroke-gray-400" fill="none" strokeWidth="3" />
              <path d="M125 180 L130 230" className="stroke-gray-400" fill="none" strokeWidth="3" />

              {/* Feet */}
              <ellipse
                cx="70"
                cy="235"
                rx="12"
                ry="6"
                className="stroke-gray-500 fill-gray-500/30"
              />
              <ellipse
                cx="130"
                cy="235"
                rx="12"
                ry="6"
                className="stroke-gray-500 fill-gray-500/30"
              />

              {/* Chest Panel */}
              <rect
                x="85"
                y="125"
                width="30"
                height="25"
                rx="3"
                className="stroke-cyan-400/50 fill-cyan-400/10"
              />
              <circle
                cx="92"
                cy="135"
                r="3"
                className="stroke-cyan-400 fill-cyan-400/40 animate-pulse"
              />
              <circle
                cx="100"
                cy="135"
                r="3"
                className="stroke-cyan-400 fill-cyan-400/40 animate-pulse"
                style={{ animationDelay: "0.3s" }}
              />
              <circle
                cx="108"
                cy="135"
                r="3"
                className="stroke-cyan-400 fill-cyan-400/40 animate-pulse"
                style={{ animationDelay: "0.6s" }}
              />
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

          {/* Business Name and Slogan */}
          <div className="absolute bottom-4 left-0 right-0 px-4 text-center">
            <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
              {state.store.name}
            </h1>
            <p className="mt-1 text-sm font-medium text-cyan-300">Qual será o seu pedido?</p>
          </div>
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
