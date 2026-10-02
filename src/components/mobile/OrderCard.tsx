import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bike,
  Check,
  Clock,
  Link as LinkIcon,
  Lock,
  MapPin,
  MessageCircle,
  Package,
  Printer,
  RefreshCw,
  Sparkles,
  Store,
  User,
} from "lucide-react";
import { ExpandableSection, InfoRow } from "@/modules/ui/ExpandableSection";
import { OrderStatusBadge } from "@/components/admin/StatusBadge";
import {
  NEXT_STATUS,
  STATUS_LABELS,
  formatElapsed,
  orderTimer,
  trackingUrl,
} from "@/modules/mobile/orders";
import { getOrderForOwner } from "@/modules/supabase/orders";
import {
  brl,
  buildThermalTicket,
  buildWhatsAppMessage,
  cn,
  printTicket,
  sendToWhatsApp,
} from "@/lib/utils";
import type { Order, OrderStatus, Restaurant } from "@/lib/types";

const TIMER_STYLE: Record<"fresh" | "attention" | "late", string> = {
  fresh: "border-white/10 bg-white/5 text-gray-400",
  attention: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  late: "border-red-500/30 bg-red-500/10 text-red-300",
};

export interface OrderCardProps {
  order: Order;
  restaurant?: Restaurant;
  /** Prévia recolhida (padrão) ou já aberta. */
  defaultOpen?: boolean;
  /** Mostra o nome da loja — útil quando a conta tem mais de um restaurante. */
  showRestaurant?: boolean;
  /** Pedido recém-recebido: realce temporário. */
  fresh?: boolean;
  /** Loja com o plano gratuito estourado: detalhes bloqueados. */
  locked?: boolean;
  onAdvance: (order: Order, status: OrderStatus) => void | Promise<void>;
  onCancel: (order: Order) => void | Promise<void>;
  busy?: boolean;
}

/**
 * Card de pedido: a prévia mostra o que o operador precisa decidir rápido
 * (cliente, valor, status, tempo parado) e o restante — itens, endereço,
 * pagamento — aparece ao expandir.
 */
export function OrderCard({
  order,
  restaurant,
  defaultOpen = false,
  showRestaurant = false,
  fresh = false,
  locked = false,
  onAdvance,
  onCancel,
  busy = false,
}: OrderCardProps) {
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const items = order.order_items ?? [];
  const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const [open, setOpen] = useState(defaultOpen);
  const [detail, setDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailBlocked, setDetailBlocked] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const isFinished = order.status === "delivered" || order.status === "cancelled";
  const nextStatus = NEXT_STATUS[order.status];
  const timer = orderTimer(order.created_at, now);

  // Relógio próprio do card: sem ele o "tempo parado" congela no valor da montagem.
  useEffect(() => {
    if (isFinished) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [isFinished]);

  // Busca os detalhes sob demanda (o card carrega sem os dados comerciais) e
  // respeita o bloqueio do plano de assinatura aplicado no banco.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    getOrderForOwner(order.id)
      .then((res) => {
        if (cancelled) return;
        if (res.blocked) setDetailBlocked(true);
        else if (res.order) setDetail(res.order);
        else setDetailError("Não foi possível carregar os detalhes deste pedido.");
      })
      .catch(() => {
        if (!cancelled) setDetailError("Não foi possível carregar os detalhes deste pedido.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, order.id]);

  const summary = useMemo(() => {
    const bits = [`${itemsCount} ${itemsCount === 1 ? "item" : "itens"}`];
    bits.push(order.delivery_type === "entrega" ? "Entrega" : "Retirada");
    if (showRestaurant && restaurant) bits.push(restaurant.name);
    return bits.join(" • ");
  }, [itemsCount, order.delivery_type, restaurant, showRestaurant]);

  function handleWhatsApp() {
    const message = buildWhatsAppMessage(order, restaurant?.name ?? "Restaurante");
    const target =
      order.customer_phone?.replace(/\D/g, "") || restaurant?.whatsapp?.replace(/\D/g, "");
    if (target) sendToWhatsApp(target, message);
  }

  async function handleCopyTracking() {
    try {
      await navigator.clipboard.writeText(trackingUrl(order.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard bloqueado — sem cópia, mas sem quebrar a tela */
    }
  }

  const borderTone = fresh
    ? "border-cyan-400/60 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
    : locked
      ? "border-amber-500/30"
      : !isFinished && timer.level === "late"
        ? "border-red-500/30"
        : !isFinished && timer.level === "attention"
          ? "border-amber-500/25"
          : undefined;

  return (
    <ExpandableSection
      open={open}
      onOpenChange={setOpen}
      className={cn(borderTone, fresh && "animate-[slide-up_0.28s_ease-out_both]")}
      icon={<Package className="size-4" />}
      tone={locked ? "amber" : "neutral"}
      title={
        <span className="flex min-w-0 items-center gap-1.5">
          {fresh && (
            <span className="shrink-0 rounded-full bg-cyan-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-black">
              Novo
            </span>
          )}
          <span className="truncate">{order.comanda}</span>
        </span>
      }
      badge={
        <span className="flex shrink-0 items-center gap-1">
          {locked && <Lock className="size-3.5 text-amber-300" />}
          <OrderStatusBadge status={order.status} size="xs" />
        </span>
      }
      summary={summary}
    >
      {/* Detalhes travados pelo plano: enquanto bloqueado, o card não exibe
          dados comerciais nem ações — só o aviso e o atalho para assinar. */}
      {detailBlocked ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-300">
              <Lock className="size-4" />
            </span>
            <p className="text-xs leading-relaxed text-amber-100">
              <span className="flex items-center gap-1.5 font-bold text-amber-200">
                <Sparkles className="size-3.5" /> Novo pedido recebido
              </span>
              Os detalhes deste pedido estão bloqueados porque o limite do plano gratuito foi
              atingido.
            </p>
          </div>

          {/* Itens não são liberados no bloqueio: o lugar deles é a ação de assinar. */}
          <Link
            to="/admin/assinatura"
            className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-500/20 to-cyan-500/5 px-3 py-2.5 transition-colors hover:border-cyan-400"
          >
            <span className="min-w-0">
              <span className="block text-xs font-black uppercase text-white">
                Assinar Premium agora
              </span>
              <span className="mt-0.5 block text-[10px] text-cyan-200/80">
                Detalhes liberados na hora
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-cyan-500 px-2.5 py-1 text-[10px] font-black text-black">
              R$ 39,90/mês
            </span>
          </Link>
          <p className="text-center text-[11px] leading-relaxed text-gray-500">
            O pedido continua salvo. Assim que o Premium for ativado, os detalhes são liberados
            automaticamente.
          </p>
        </div>
      ) : detailLoading && !detail ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400">
          <RefreshCw className="size-4 animate-spin" /> Carregando detalhes…
        </div>
      ) : detailError && !detail ? (
        <p className="rounded-xl border border-red-500/25 bg-red-500/[0.07] p-3 text-xs text-red-200">
          {detailError}
        </p>
      ) : (
        <div className="space-y-3">
          {/* Linha de decisão: valor + tempo parado */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-sm font-bold text-cyan-300">
              {brl(Number(order.total))}
            </span>
            {!isFinished && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold",
                  TIMER_STYLE[timer.level],
                )}
              >
                <Clock className="size-3" />
                {formatElapsed(timer.minutes)} · {STATUS_LABELS[order.status]}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-gray-400">
              {order.delivery_type === "entrega" ? (
                <Bike className="size-3" />
              ) : (
                <Store className="size-3" />
              )}
              {order.delivery_type === "entrega" ? "Entrega" : "Retirada"}
            </span>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <InfoRow
              label="Cliente"
              value={order.customer_name}
              icon={<User className="size-3" />}
            />
            {order.customer_phone && <InfoRow label="Telefone" value={order.customer_phone} />}
            <InfoRow
              label="Recebido"
              value={new Date(order.created_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
            <InfoRow label="Pagamento" value={order.payment_method || "—"} />
            {order.delivery_type === "entrega" && (
              <InfoRow
                label="Endereço"
                value={order.delivery_address || "—"}
                icon={<MapPin className="size-3" />}
              />
            )}
          </div>

          {order.observations && (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-200/90">
              {order.observations}
            </p>
          )}

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Itens
            </p>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 font-bold text-gray-400">{item.quantity}x</span>
                  <span className="min-w-0 flex-1 text-gray-200">
                    {item.product_name}
                    {item.notes && (
                      <span className="mt-0.5 block text-[11px] italic text-amber-200/80">
                        {item.notes}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold text-gray-300">
                    {brl(Number(item.total))}
                  </span>
                </li>
              ))}
              {items.length === 0 && (
                <li className="text-xs text-gray-500">Nenhum item registrado.</li>
              )}
            </ul>
          </div>

          <div className="border-t border-white/[0.06] pt-2">
            {Number(order.delivery_fee) > 0 && (
              <InfoRow label="Taxa de entrega" value={brl(Number(order.delivery_fee))} />
            )}
            <InfoRow
              label="Total"
              value={
                <span className="text-sm font-bold text-cyan-300">{brl(Number(order.total))}</span>
              }
            />
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
            {nextStatus && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onAdvance(order, nextStatus)}
                className="min-w-[8rem] flex-1 rounded-xl bg-cyan-500 px-3 py-2.5 text-xs font-bold uppercase text-black transition-colors hover:bg-cyan-400 disabled:opacity-50"
              >
                {STATUS_LABELS[nextStatus]}
              </button>
            )}
            {!isFinished && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onCancel(order)}
                className="rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-bold uppercase text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={handleWhatsApp}
              title="Enviar pedido por WhatsApp"
              className="grid size-10 place-items-center rounded-xl bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <MessageCircle className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleCopyTracking}
              title="Copiar link de acompanhamento"
              className={cn(
                "grid size-10 place-items-center rounded-xl transition-colors",
                copied
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white",
              )}
            >
              {copied ? <Check className="size-4" /> : <LinkIcon className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() =>
                printTicket(buildThermalTicket(order, restaurant?.name ?? "Restaurante"))
              }
              title="Imprimir comanda"
              className="grid size-10 place-items-center rounded-xl bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Printer className="size-4" />
            </button>
          </div>
        </div>
      )}
    </ExpandableSection>
  );
}
