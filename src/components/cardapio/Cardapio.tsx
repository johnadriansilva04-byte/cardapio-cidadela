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
    <div className="min-h-screen pb-28 bg-black">
      <header className="relative overflow-hidden border-b border-border">
        {/* Cidadela Button - Half Moon Top Right */}
        <button
          type="button"
          onClick={() => navigate({ to: "/cidadela" })}
          aria-label="Entrar na Cidadela"
          title="Entrar na Cidadela"
          className="fixed top-4 right-4 z-50 flex shrink-0 items-center gap-2 rounded-l-full rounded-r-lg px-4 py-2 transition-transform hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, rgba(0, 212, 255, 0.3), rgba(0, 150, 255, 0.2))",
            border: "2px solid #00d4ff",
            boxShadow: "0 0 15px rgba(0, 212, 255, 0.5), inset 0 0 20px rgba(0, 212, 255, 0.2)",
            backdropFilter: "blur(10px)",
          }}
        >
          <span className="text-[10px] font-black text-white drop-shadow-[0_0_8px_rgba(0,212,255,1)]">
            CONHEÇA A CIDADELA
          </span>
          <svg
            viewBox="0 0 24 24"
            className="size-4 drop-shadow-[0_0_8px_rgba(255,215,0,1)]"
            fill="none"
            stroke="#ffd700"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </button>

        {/* Admin Button - Fixed Bottom Right */}
        <button
          type="button"
          onClick={onOpenAdmin}
          aria-label="ADM"
          title="ADM"
          className="fixed bottom-4 right-4 z-50 flex size-12 items-center justify-center rounded-full border-2 border-yellow-500 bg-yellow-500/20 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)] transition-all hover:border-yellow-400 hover:bg-yellow-500/30 hover:shadow-[0_0_25px_rgba(234,179,8,0.7)] hover:scale-110"
        >
          <Settings className="size-6" />
        </button>

        {/* Cover Photo Banner */}
        <div
          className="h-56 w-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: state.store.coverPhoto
              ? `url(${state.store.coverPhoto})`
              : "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          }}
        />

        {/* Business Info - Centered Below Cover */}
        <div className="relative mx-auto max-w-5xl px-5 py-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {state.store.name}
          </h1>
          <p className="mt-2 text-sm text-gray-300">{state.store.slogan}</p>
          {!online && (
            <p className="mt-3 inline-block rounded-full bg-red-500/10 px-4 py-1.5 text-[11px] text-red-400">
              Offline — pedidos serão sincronizados
            </p>
          )}
        </div>

        {/* Animated Marquee - Below header section */}
        <div className="mt-2 overflow-hidden border-t border-cyan-500/20 bg-black/40 py-2">
          <div className="marquee-track text-tech text-[11px] animate-marquee text-cyan-400">
            <span className="px-6">{state.store.marquee}</span>
            <span className="px-6">{state.store.marquee}</span>
            <span className="px-6">{state.store.marquee}</span>
            <span className="px-6">{state.store.marquee}</span>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-20 border-b border-cyan-500/20 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-5 py-3">
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
              className={`text-tech shrink-0 rounded-full px-4 py-2 text-[11px] transition-colors ${
                activeCat === cat.name
                  ? "bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                  : "bg-slate-900 text-gray-400 hover:bg-slate-800"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-5">
        {state.categories.map((cat) => (
          <section key={cat.name} id={`cat-${cat.name}`} className="scroll-mt-20 pt-8">
            <h2 className="text-xl font-semibold text-white">{cat.name}</h2>
            <div className="mt-4 space-y-3">
              {cat.items.map((item) => (
                <article
                  key={item.id}
                  className="group relative flex items-center gap-4 rounded-lg border border-cyan-500/20 bg-gradient-to-r from-black/60 to-slate-900/60 p-3 transition-all hover:border-cyan-500/40 hover:shadow-[0_0_10px_rgba(0,212,255,0.2)]"
                >
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-cyan-500/10 text-lg">
                      {item.img}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300">
                        {item.name}
                      </h3>
                      <p className="line-clamp-2 text-[10px] text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-sm font-bold text-white">{brl(item.price)}</p>
                  </div>
                  <div className="flex shrink-0 justify-center">
                    {cart[item.id] ? (
                      <div className="flex items-center gap-1 rounded-full bg-cyan-500/20 p-1">
                        <button
                          type="button"
                          aria-label={`Remover ${item.name}`}
                          onClick={() => remove(item.id)}
                          className="grid size-6 place-items-center rounded-full bg-slate-800 hover:bg-slate-700"
                        >
                          <Minus className="size-3 text-cyan-300" />
                        </button>
                        <span className="w-4 text-center text-sm font-semibold text-white">
                          {cart[item.id]}
                        </span>
                        <button
                          type="button"
                          aria-label={`Adicionar ${item.name}`}
                          onClick={() => add(item.id)}
                          className="grid size-6 place-items-center rounded-full bg-cyan-500 hover:bg-cyan-400"
                        >
                          <Plus className="size-3 text-slate-900" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => add(item.id)}
                        className="mx-2 rounded-full border border-cyan-500/50 bg-cyan-500/10 px-4 py-1.5 text-[10px] font-semibold text-cyan-300 transition-all hover:bg-cyan-500/30 hover:shadow-[0_0_10px_rgba(0,212,255,0.4)]"
                      >
                        Adicionar
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        <footer className="mt-14 flex flex-col items-center gap-2 border-t border-border py-8 text-center">
          <CobraFumando className="size-8 text-muted-foreground/50" />
          <p className="text-tech text-[10px] text-muted-foreground">
            A cobra está fumando — honra, dignidade e brio
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            PIX: {state.payment.pixKey} · WhatsApp: {state.whatsapp}
          </p>
        </footer>
      </main>

      {count > 0 && !cartOpen && !checkoutOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="ember-glow fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center justify-between rounded-full bg-primary px-5 py-4 text-primary-foreground"
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
