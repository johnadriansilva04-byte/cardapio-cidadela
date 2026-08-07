import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShoppingBag, Plus, Minus, Menu, User, Settings } from "lucide-react";
import RobotWaiter from "./RobotWaiter";
import CartSheet from "./CartSheet";
import CheckoutModal, { type CheckoutForm } from "./CheckoutModal";
import PaymentScreen from "./PaymentScreen";
import SuccessModal from "./SuccessModal";
import VideoBonusModal from "./VideoBonusModal";
import AdminModal from "./AdminModal";
import { useStore } from "@/modules/cidadela-core/store";
import { supabase } from "@/modules/supabase/client";
import type { MenuItem, Order } from "@/lib/types";
import {
  brl,
  newComanda,
  generatePromoCode,
  buildThermalTicket,
  printTicket,
  sendToN8n,
} from "@/modules/cidadela-core/utils";
import { buildOrderPayload } from "@/modules/fluxos-n8n/webhook";

export default function Cardapio() {
  const navigate = useNavigate();
  const { state, update, addSoberaniaPoints } = useStore();

  const [cart, setCart] = useState<Record<string, number>>({});
  const [activeCat, setActiveCat] = useState(state.categories[0]?.id ?? "");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [videoPoints, setVideoPoints] = useState(0);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [successCode, setSuccessCode] = useState<{
    code: string;
    access_type: "15_min" | "15_dias";
  } | null>(null);
  const [successPoints, setSuccessPoints] = useState(0);
  const sectionsRef = useRef<Record<string, HTMLElement | null>>({});

  const allItems = useMemo(
    () => state.categories.flatMap((c) => c.items),
    [state.categories],
  );

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ item: allItems.find((i) => i.id === id) as MenuItem, qty }))
        .filter((l) => Boolean(l.item)),
    [cart, allItems],
  );

  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.item.price * l.qty, 0);

  const discountPercentage = useMemo(() => {
    const tiers = state.admin.discountTiers ?? [];
    const points = state.soberania.points;
    return tiers
      .filter((t) => points >= t.points)
      .reduce((max, t) => Math.max(max, t.percentage), 0);
  }, [state.admin.discountTiers, state.soberania.points]);

  const discountAmount = subtotal * (discountPercentage / 100);
  const totalWithDiscount = subtotal - discountAmount;

  function add(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }
  function remove(id: string) {
    setCart((c) => {
      const next = { ...c };
      const cur = next[id] ?? 0;
      if (cur <= 1) delete next[id];
      else next[id] = cur - 1;
      return next;
    });
  }

  function scrollToCat(id: string) {
    setActiveCat(id);
    sectionsRef.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleCheckout(form: CheckoutForm) {
    const order: Order = {
      comanda: newComanda(),
      cliente: form.cliente,
      ...(form.email ? { email: form.email } : {}),
      telefone: form.telefone,
      endereco: form.endereco,
      observacoes: form.observacoes,
      itens: lines.map((l) => ({
        id: l.item.id,
        name: l.item.name,
        quantity: l.qty,
        price: l.item.price,
        total: l.item.price * l.qty,
      })),
      total: totalWithDiscount,
      tipo_entrega: form.tipo_entrega,
      taxa_entrega: 0,
      pagamento: form.pagamento,
      ...(form.troco ? { troco: form.troco } : {}),
      status: "pendente",
      createdAt: new Date().toISOString(),
      synced: false,
    };
    setCheckoutOpen(false);
    setPendingOrder(order);
  }

  async function finalizeOrder(order: Order) {
    const storeId = state.admin.storeId ?? "";
    const accessType: "15_min" | "15_dias" = order.total >= 200 ? "15_dias" : "15_min";
    const { code, expiration } = generatePromoCode(undefined, accessType);

    try {
      await supabase.from("cidadela_codes").insert({
        code,
        store_id: storeId,
        customer_email: order.email ?? null,
        customer_phone: order.telefone,
        access_type: accessType,
        order_total: order.total,
        expires_at: expiration.toISOString(),
        is_active: true,
      });

      const { data: inserted } = await supabase
        .from("orders")
        .insert({
          store_id: storeId,
          customer_name: order.cliente,
          customer_email: order.email ?? null,
          customer_phone: order.telefone,
          delivery_address: order.endereco,
          delivery_type: order.tipo_entrega,
          observations: order.observacoes,
          subtotal,
          delivery_fee: order.taxa_entrega,
          total: order.total,
          payment_method: order.pagamento,
          change_for: order.troco ? Number(order.troco.replace(/[^\d.,]/g, "").replace(",", ".")) || null : null,
          comanda: order.comanda,
          status: "pendente",
          cidadela_code: code,
          cidadela_access_type: accessType,
          payment_status: order.pagamento === "pix" ? "awaiting_confirmation" : "pending",
        })
        .select()
        .single();

      if (inserted) {
        await supabase.from("order_items").insert(
          order.itens.map((i) => ({
            order_id: inserted.id,
            product_id: i.id,
            product_name: i.name,
            quantity: i.quantity,
            unit_price: i.price,
            total: i.total,
          })),
        );
      }
    } catch (e) {
      console.error("Erro ao salvar pedido", e);
    }

    const points = Math.floor(order.total / 30);
    if (points > 0) {
      const customerEmail = order.email || order.telefone;
      addSoberaniaPoints(storeId, customerEmail, order.telefone, points, `Pedido de R$${order.total.toFixed(2)}`, "order");
    }

    update((s) => {
      s.orders = [order, ...s.orders];
      s.cidadela.codes = [
        { code, access_type: accessType, expires_at: expiration.toISOString() },
        ...s.cidadela.codes,
      ];
    });

    // Payload completo conforme documentação do N8N com código da Cidadela
    const payloadWithCode = buildOrderPayload(
      order,
      code,
      accessType,
      state.admin.phone || state.whatsapp,
      state.admin.email,
      storeId,
    );

    await sendToN8n(state.integrations.n8nWebhookUrl, payloadWithCode);

    setCart({});
    setPendingOrder(null);
    setSuccessCode({ code, access_type: accessType });

    if (points > 0) {
      setVideoPoints(points);
    } else {
      setSuccessPoints(0);
      setSuccessOrder(order);
    }
  }

  function handlePrint() {
    if (!successOrder) return;
    const ticket = buildThermalTicket(successOrder, state.store.name);
    printTicket(ticket);
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="relative">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            type="button" 
            onClick={() => navigate({ to: "/" })} 
            className="text-white"
          >
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
            onClick={() => setAdminOpen(true)}
            className="text-[color:var(--color-brass)]"
          >
            <Settings className="size-6" />
          </button>
        </div>

        <div className="relative">
          <div
            className="h-64 w-full bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: state.store.coverPhoto
                ? `url(${state.store.coverPhoto})`
                : "radial-gradient(ellipse at center top, #e8f4fc 0%, #87ceeb 30%, #4682b4 60%, #1e3a5f 100%)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black" />
          <div className="absolute top-4 left-0 right-0 px-4 text-center">
            <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
              {state.store.name}
            </h1>
            <p className="mt-1 text-sm font-medium text-cyan-300">Qual será o seu pedido?</p>
          </div>
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
            <RobotWaiter />
          </div>
        </div>
      </header>

      <main className="px-4 pb-24">
        {/* Categories */}
        <div className="sticky top-0 z-40 bg-black/95 backdrop-blur py-3">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {state.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollToCat(cat.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold uppercase transition-colors ${
                  activeCat === cat.id
                    ? "bg-[color:var(--color-brass)] text-black"
                    : "border border-[color:var(--color-brass)]/30 text-[color:var(--color-brass)]"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items */}
        <div className="mt-4 space-y-6">
          {state.categories.map((cat) => (
            <section
              key={cat.id}
              ref={(el) => (sectionsRef.current[cat.id] = el)}
              className="scroll-mt-20"
            >
              <h2 className="mb-3 text-lg font-bold text-[color:var(--color-brass)]">{cat.name}</h2>
              <div className="grid gap-3">
                {cat.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 rounded-xl border border-[color:var(--color-brass)]/20 bg-black/40 p-3"
                  >
                    <div className="flex-1">
                      <h3 className="font-bold text-white">{item.name}</h3>
                      <p className="mt-1 text-xs text-gray-400">{item.desc}</p>
                      <p className="mt-2 text-sm font-bold text-[color:var(--color-brass)]">{brl(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => remove(item.id)}
                        className="grid size-6 place-items-center rounded-full bg-black/50 hover:bg-black/70"
                        aria-label="Diminuir"
                      >
                        <Minus className="size-3 text-white" />
                      </button>
                      <span className="w-5 text-center text-sm font-bold text-white">
                        {cart[item.id] || 0}
                      </span>
                      <button
                        onClick={() => add(item.id)}
                        className="grid size-6 place-items-center rounded-full bg-[color:var(--color-brass)] hover:bg-[color:var(--color-brass)]/80"
                        aria-label="Aumentar"
                      >
                        <Plus className="size-3 text-black" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Floating Cart Button */}
      {count > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-[color:var(--color-brass)] px-4 py-3 text-sm font-bold text-black shadow-lg"
        >
          <ShoppingBag className="size-5" />
          <span>{count} itens</span>
          <span className="font-black">{brl(totalWithDiscount)}</span>
        </button>
      )}

      {/* Modals */}
      {cartOpen && (
        <CartSheet
          lines={lines}
          subtotal={subtotal}
          discountPercentage={discountPercentage}
          discountAmount={discountAmount}
          total={totalWithDiscount}
          onInc={add}
          onDec={remove}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />
      )}

      {checkoutOpen && (
        <CheckoutModal
          total={totalWithDiscount}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={handleCheckout}
        />
      )}

      {pendingOrder && (
        <PaymentScreen
          order={pendingOrder}
          onConfirm={() => {
            finalizeOrder(pendingOrder);
          }}
          onCancel={() => setPendingOrder(null)}
        />
      )}

      {videoPoints > 0 && !successOrder && (
        <VideoBonusModal
          points={videoPoints}
          adSlot={state.integrations.adSlot}
          onFinish={(earnedBonus) => {
            if (earnedBonus) {
              // Dobra os pontos
              const finalPoints = videoPoints * 2;
              addSoberaniaPoints(
                state.admin.storeId || "",
                pendingOrder?.email || pendingOrder?.telefone || "",
                pendingOrder?.telefone || "",
                videoPoints,
                "Bônus de vídeo assistido",
                "ad"
              );
              setSuccessPoints(finalPoints);
            } else {
              setSuccessPoints(videoPoints);
            }
            setSuccessOrder(pendingOrder);
            setVideoPoints(0);
          }}
        />
      )}

      {successOrder && (
        <SuccessModal
          order={successOrder}
          cidadelaCode={successCode}
          points={successPoints}
          onClose={() => {
            setSuccessOrder(null);
            setSuccessCode(null);
            setSuccessPoints(0);
          }}
          onPrint={handlePrint}
        />
      )}

      {adminOpen && (
        <AdminModal
          onClose={() => setAdminOpen(false)}
        />
      )}
    </div>
  );
}
