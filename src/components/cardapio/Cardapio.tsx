import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ShoppingBag, Plus, Minus, Menu, User, Settings } from "lucide-react";
import RobotWaiter from "./RobotWaiter";
import CartSheet from "./CartSheet";
import CheckoutModal, { type CheckoutForm } from "./CheckoutModal";
import PaymentScreen from "./PaymentScreen";
import SuccessModal from "./SuccessModal";
import VideoBonusModal from "./VideoBonusModal";
import AdminModal from "./AdminModal";
import { useStore } from "@/modules/core/store";
import { supabase } from "@/modules/supabase/client";
import type { MenuItem, Order } from "@/lib/types";
import {
  brl,
  newComanda,
  generatePromoCode,
  buildThermalTicket,
  printTicket,
  sendToN8N,
} from "@/modules/core/utils";

export default function Cardapio() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/" });
  const state = useStore();
  const update = useStore((s) => s.update);

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
  const [ownerWhatsApp, setOwnerWhatsApp] = useState(state.whatsapp);
  const sectionsRef = useRef<Record<string, HTMLElement | null>>({});

  // Carregar configurações do restaurante baseado no store_id da URL
  useEffect(() => {
    const storeIdFromUrl = search.store_id as string | undefined;
    if (storeIdFromUrl) {
      loadStoreConfig(storeIdFromUrl);
    }
  }, [search.store_id]);

  async function loadStoreConfig(storeId: string) {
    try {
      const { data: adminData } = await supabase
        .from("admin_trials")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();

      if (adminData) {
        update((s) => {
          s.admin.storeId = adminData.store_id;
          s.admin.email = adminData.admin_email ?? "";
          s.admin.phone = adminData.admin_phone ?? "";
          s.store.name = adminData.store_name || s.store.name;
          s.store.slogan = adminData.store_slogan || s.store.slogan;
          s.store.marquee = adminData.store_marquee || s.store.marquee;
          s.payment.pixKey = adminData.pix_key || s.payment.pixKey;
          s.whatsapp = adminData.whatsapp || s.whatsapp;
        });
        setOwnerWhatsApp(adminData.whatsapp || state.whatsapp);
      }
    } catch (error) {
      console.error("Erro ao carregar configurações do restaurante:", error);
    }
  }

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

    let ownerWhatsApp = state.whatsapp;

    try {
      // Buscar WhatsApp do dono correto baseado no store_id
      if (storeId) {
        const { data: adminData } = await supabase
          .from("admin_trials")
          .select("whatsapp")
          .eq("store_id", storeId)
          .maybeSingle();
        if (adminData?.whatsapp) {
          ownerWhatsApp = adminData.whatsapp;
        }
      }

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

        // Salvar código Cidadela após ter o order_id
        await supabase.from("cidadela_codes").insert({
          code,
          store_id: storeId,
          customer_email: order.email ?? null,
          customer_phone: order.telefone,
          access_type: accessType,
          order_total: order.total,
          expires_at: expiration.toISOString(),
          is_active: true,
          order_id: inserted.id,
        });
      }
    } catch (e) {
      console.error("Erro ao salvar pedido", e);
    }

    const points = Math.floor(order.total / 30);
    if (points > 0) await savePoints(order, points, "order", "Pedido concluído");

    update((s) => {
      s.orders = [order, ...s.orders];
      s.cidadela.codes = [
        { code, access_type: accessType, expires_at: expiration.toISOString() },
        ...s.cidadela.codes,
      ];
    });

    sendToN8N(state.integrations.n8nWebhookUrl, {
      nome: order.cliente,
      comanda: order.comanda,
      telefone: order.telefone,
      itens: order.itens,
      total: order.total,
      endereco: order.endereco,
      observacao: order.observacoes,
      pagamento: order.pagamento,
      troco: order.troco,
      tipo_entrega: order.tipo_entrega,
      taxa_entrega: order.taxa_entrega,
      store_id: storeId,
      store_name: state.store.name,
      store_whatsapp: ownerWhatsApp,
      cidadela_code: code,
      cidadela_access_type: accessType,
    });

    setCart({});
    setPendingOrder(null);
    setSuccessCode({ code, access_type: accessType });
    setOwnerWhatsApp(ownerWhatsApp);

    if (points > 0) {
      setVideoPoints(points);
    } else {
      setSuccessPoints(0);
      setSuccessOrder(order);
    }
  }

  async function savePoints(
    order: Order,
    amount: number,
    source: "order" | "ad",
    reason: string,
  ) {
    const storeId = state.admin.storeId ?? "";
    try {
      const { data: existing } = await supabase
        .from("soberania_points")
        .select("*")
        .eq("customer_phone", order.telefone)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("soberania_points")
          .update({ points: existing.points + amount, last_updated: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("soberania_points").insert({
          store_id: storeId,
          customer_email: order.email ?? null,
          customer_phone: order.telefone,
          points: amount,
        });
      }

      await supabase.from("soberania_transactions").insert({
        store_id: storeId,
        customer_email: order.email ?? null,
        customer_phone: order.telefone,
        type: source === "ad" ? "rewarded" : "earned",
        amount,
        reason,
        source,
      });
    } catch (e) {
      console.error("Erro ao salvar pontos", e);
    }

    update((s) => {
      s.soberania.points += amount;
      s.soberania.history = [
        {
          id: crypto.randomUUID(),
          type: source === "ad" ? "rewarded" : "earned",
          amount,
          reason,
          source,
          timestamp: new Date().toISOString(),
        },
        ...s.soberania.history,
      ];
    });
  }

  const currentOrder = successOrder;

  return (
    <div className="min-h-screen bg-black">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate({ to: "/" })} aria-label="Voltar">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          {state.store.marquee}
        </span>
        <span className="w-5" />
      </div>

      {/* Banner */}
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

        <div className="absolute left-0 right-0 top-4 px-4 text-center">
          <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
            {state.store.name}
          </h1>
          <p className="mt-1 text-sm font-medium text-cyan-300">Qual será o seu pedido?</p>
        </div>

        <div className="animate-float absolute left-1/2 top-20 flex -translate-x-1/2 flex-col items-center">
          <RobotWaiter />
        </div>

        {/* Botão da Cidadela */}
        <a
          href="http://localhost:3001"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-4 top-16 z-50 size-20 transition-transform hover:scale-105 active:scale-95"
          aria-label="Conheça a Cidadela"
        >
          <span className="absolute inset-0 animate-pulse rounded-full bg-cyan-400/60" />
          <span className="relative flex size-20 flex-col items-center justify-center rounded-full border-2 border-cyan-400 bg-black/70 shadow-[0_0_30px_rgba(34,211,238,0.7)]">
            <span className="px-1 text-[10px] font-bold leading-tight tracking-tight text-cyan-300">
              CONHEÇA A CIDADELA
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="mt-1 size-7 text-yellow-400"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
        </a>
      </div>

      {/* Categorias */}
      <div className="sticky top-0 z-20 border-b border-red-500/20 bg-black/90 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {state.categories.map((c) => (
            <button
              key={c.id}
              onClick={() => scrollToCat(c.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold transition-all ${
                activeCat === c.id
                  ? "border border-red-500 bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                  : "border border-red-500/30 bg-black/50 text-gray-400 hover:bg-red-500/10"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Produtos */}
      <main className="px-4 pb-40">
        <div className="mx-auto max-w-xl">
          {state.categories.map((cat) => (
            <section
              key={cat.id}
              ref={(el) => {
                sectionsRef.current[cat.id] = el;
              }}
              className="scroll-mt-20 pt-6"
            >
              <h2 className="mb-4 text-lg font-bold text-white">{cat.name}</h2>
              <div className="space-y-3">
                {cat.items.map((item) => (
                  <div
                    key={item.id}
                    className="group relative flex items-center gap-4 rounded-xl border border-red-500/20 bg-black/40 p-4 transition-all hover:border-red-500/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                  >
                    <span className="size-3 shrink-0 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8),0_0_16px_rgba(239,68,68,0.6),0_0_24px_rgba(239,68,68,0.4)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-white transition-colors group-hover:text-red-400">
                        {item.name}
                      </p>
                      {item.desc && (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-400">{item.desc}</p>
                      )}
                      <p className="mt-1 text-sm font-bold text-white">{brl(item.price)}</p>
                    </div>
                    {cart[item.id] ? (
                      <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/20 p-1">
                        <button
                          onClick={() => remove(item.id)}
                          className="grid size-6 place-items-center rounded-full bg-black/50 hover:bg-black/70"
                          aria-label={`Remover ${item.name}`}
                        >
                          <Minus className="size-3 text-white" />
                        </button>
                        <span className="w-4 text-center text-xs font-bold text-white">
                          {cart[item.id]}
                        </span>
                        <button
                          onClick={() => add(item.id)}
                          className="grid size-6 place-items-center rounded-full bg-red-600 hover:bg-red-500"
                          aria-label={`Adicionar ${item.name}`}
                        >
                          <Plus className="size-3 text-white" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => add(item.id)}
                        className="flex items-center gap-1 rounded-lg border border-red-500/50 bg-black/50 px-3 py-1.5 text-[10px] font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                      >
                        <Plus className="size-3" /> ADD
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Carrinho flutuante */}
      {count > 0 && !cartOpen && !checkoutOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-md items-center justify-between rounded-full bg-red-600 px-5 py-4 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="size-4" /> {count} {count === 1 ? "item" : "itens"}
          </span>
          <span className="text-sm font-bold">{brl(totalWithDiscount)}</span>
        </button>
      )}

      {/* Navegação inferior */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-red-500/20 bg-black/95 backdrop-blur">
        <div className="flex items-center justify-around py-3">
          <button className="flex flex-col items-center gap-1">
            <span className="relative">
              <span className="absolute inset-0 animate-pulse rounded-full bg-red-500/20" />
              <Menu className="relative size-6 text-red-500" />
            </span>
            <span className="text-[10px] font-semibold text-red-500">CARDÁPIO</span>
          </button>
          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300"
          >
            <User className="size-6" />
            <span className="text-[10px] font-semibold">CIDADELA</span>
          </a>
          <button
            onClick={() => setAdminOpen(true)}
            className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300"
          >
            <Settings className="size-6" />
            <span className="text-[10px] font-semibold">PAINEL</span>
          </button>
        </div>
        <div className="flex items-center justify-center gap-4 border-t border-red-500/10 pb-3 pt-2">
          <button
            onClick={() => navigate({ to: "/privacy" })}
            className="text-[9px] text-gray-500 transition-colors hover:text-gray-300"
          >
            Privacidade
          </button>
          <span className="text-[9px] text-gray-600">•</span>
          <button
            onClick={() => navigate({ to: "/terms" })}
            className="text-[9px] text-gray-500 transition-colors hover:text-gray-300"
          >
            Termos
          </button>
        </div>
      </nav>

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
          pixKey={state.payment.pixKey}
          onClose={() => setPendingOrder(null)}
          onSuccess={() => finalizeOrder(pendingOrder)}
        />
      )}

      {videoPoints > 0 && (
        <VideoBonusModal
          points={videoPoints}
          onFinish={async (earned) => {
            const order = state.orders[0];
            if (earned && order) {
              await savePoints(order, videoPoints, "ad", "Bônus por assistir vídeo");
              setSuccessPoints(videoPoints * 2);
            } else {
              setSuccessPoints(videoPoints);
            }
            setVideoPoints(0);
            if (order) setSuccessOrder(order);
          }}
        />
      )}

      {currentOrder && (
        <SuccessModal
          order={currentOrder}
          cidadelaCode={successCode}
          points={successPoints}
          ownerWhatsApp={ownerWhatsApp}
          onClose={() => {
            setSuccessOrder(null);
            setSuccessCode(null);
          }}
        />
      )}

      {adminOpen && <AdminModal onClose={() => setAdminOpen(false)} />}
    </div>
  );
}
