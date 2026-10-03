import { useEffect, useMemo, useState } from "react";
import {
  Bike,
  Check,
  ChefHat,
  Clock,
  Flame,
  Lock,
  MapPin,
  Store,
  User,
  X,
  XCircle,
} from "lucide-react";
import { ORDER_STATUS_LABELS, type Order, type OrderStatus } from "@/lib/types";
import { formatElapsed, orderTimer } from "@/modules/mobile/orders";
import { brl, cn } from "@/lib/utils";

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  received: "preparing",
  preparing: "ready",
  ready: "out_for_delivery",
  out_for_delivery: "delivered",
  delivered: null,
  cancelled: null,
};

/** Verbos de ação, no lugar do nome do status — o botão diz o que vai acontecer. */
const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  preparing: "Começar preparo",
  ready: "Marcar pronto",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
};

const QUEUE_TABS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "queue", label: "Fila", statuses: ["received", "preparing"] },
  { key: "ready", label: "Prontos", statuses: ["ready"] },
  { key: "route", label: "A caminho", statuses: ["out_for_delivery"] },
];

const TIMER_TONE: Record<"fresh" | "attention" | "late", string> = {
  fresh: "text-emerald-300",
  attention: "text-amber-300",
  late: "text-red-300",
};

const TIMER_RING: Record<"fresh" | "attention" | "late", string> = {
  fresh: "border-emerald-500/30 bg-emerald-500/[0.07]",
  attention: "border-amber-500/30 bg-amber-500/[0.07]",
  late: "border-red-500/40 bg-red-500/[0.10]",
};

export interface KitchenModeProps {
  orders: Order[];
  lockedStores: Set<string>;
  restaurantNames: Map<string, string>;
  multi: boolean;
  onAdvance: (order: Order, status: OrderStatus) => void;
  onCancel: (order: Order) => void;
  onClose: () => void;
}

/**
 * Modo Cozinha: tela cheia, um pedido por vez, letras e botões grandes.
 *
 * O Kanban funciona bem no desktop, mas no celular apoiado na bancada ele
 * empilha quatro colunas e a cozinha rola a tela procurando o próximo pedido.
 * Aqui a fila é linear — o mais antigo primeiro — e avançar é um toque só.
 */
export function KitchenMode({
  orders,
  lockedStores,
  restaurantNames,
  multi,
  onAdvance,
  onCancel,
  onClose,
}: KitchenModeProps) {
  const [tab, setTab] = useState<string>("queue");
  const [now, setNow] = useState(() => Date.now());

  // Relógio da tela: atualiza a cada 15s para o "tempo parado" não congelar.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  // Trava o scroll do painel atrás do overlay.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const activeTab = QUEUE_TABS.find((t) => t.key === tab) ?? QUEUE_TABS[0];

  const queue = useMemo(() => {
    return orders
      .filter((o) => activeTab.statuses.includes(o.status))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [orders, activeTab]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of QUEUE_TABS) {
      map[t.key] = orders.filter((o) => t.statuses.includes(o.status)).length;
    }
    return map;
  }, [orders]);

  const current = queue[0] ?? null;
  const nextUp = queue.slice(1, 5);
  const timer = current ? orderTimer(current.created_at, now) : null;
  const next = current ? NEXT_STATUS[current.status] : null;
  const locked = current ? lockedStores.has(current.restaurant_id) : false;
  const itemsCount = current
    ? (current.order_items ?? []).reduce((sum, i) => sum + i.quantity, 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#07070b] text-white">
      {/* Cabeçalho */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300">
          <ChefHat className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-widest text-white">Modo Cozinha</p>
          <p className="text-[11px] text-gray-500">
            {queue.length === 0
              ? "Nada na fila"
              : `${queue.length} na ${activeTab.label.toLowerCase()} · mais antigo primeiro`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Sair do modo cozinha"
        >
          <X className="size-5" />
        </button>
      </header>

      {/* Abas da fila */}
      <nav className="flex shrink-0 gap-1.5 border-b border-white/10 px-4 py-2.5">
        {QUEUE_TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors",
                active
                  ? "bg-cyan-500 text-black"
                  : "bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-black",
                  active ? "bg-black/20 text-black" : "bg-white/10 text-white",
                )}
              >
                {counts[t.key] ?? 0}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Pedido atual */}
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        {!current ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="grid size-16 place-items-center rounded-3xl bg-white/[0.04] text-gray-600">
              <Check className="size-8" />
            </span>
            <p className="mt-4 text-lg font-bold text-white">
              {activeTab.key === "queue"
                ? "Fila limpa"
                : `Nada em ${activeTab.label.toLowerCase()}`}
            </p>
            <p className="mt-1 max-w-xs text-sm text-gray-500">
              Os pedidos novos aparecem aqui sozinhos, em tempo real.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-3">
            {/* Faixa de decisão: comanda + tempo */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {current.comanda}
                </p>
                {multi && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                    <Store className="size-3" /> {restaurantNames.get(current.restaurant_id)}
                  </p>
                )}
              </div>
              {timer && (
                <div
                  className={cn(
                    "shrink-0 rounded-2xl border px-4 py-2 text-right",
                    TIMER_RING[timer.level],
                  )}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Parado há
                  </p>
                  <p
                    className={cn(
                      "flex items-center justify-end gap-1.5 text-xl font-black tabular-nums",
                      TIMER_TONE[timer.level],
                    )}
                  >
                    <Clock className="size-4" />
                    {formatElapsed(timer.minutes)}
                  </p>
                </div>
              )}
            </div>

            {/* Cliente + entrega */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-gray-200">
                <User className="size-3.5 text-gray-500" /> {current.customer_name}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold",
                  current.delivery_type === "entrega"
                    ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
                    : "border-white/10 bg-white/[0.04] text-gray-200",
                )}
              >
                {current.delivery_type === "entrega" ? (
                  <Bike className="size-3.5" />
                ) : (
                  <Store className="size-3.5" />
                )}
                {current.delivery_type === "entrega" ? "Entrega" : "Retirada"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-gray-200">
                {itemsCount} {itemsCount === 1 ? "item" : "itens"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-sm font-black text-cyan-300">
                {brl(Number(current.total))}
              </span>
            </div>

            {/* Itens — o coração da tela, em letra grande. Com a loja bloqueada
                pelo plano os itens não aparecem: o lugar deles é o aviso. */}
            {locked ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-5 text-center">
                <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-amber-500/15 text-amber-300">
                  <Lock className="size-5" />
                </span>
                <p className="mt-3 text-base font-bold text-amber-200">
                  Detalhes bloqueados pelo plano
                </p>
                <p className="mt-1 text-sm text-amber-200/75">
                  O pedido chegou e continua salvo. Assine o Premium para ver os itens e liberar as
                  ações.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  <Flame className="size-3.5" /> Para preparar
                </p>
                {(current.order_items ?? []).length === 0 ? (
                  <p className="py-2 text-sm text-gray-500">
                    Detalhes dos itens não disponíveis neste pedido.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {(current.order_items ?? []).map((item) => {
                      const notes = (item as unknown as { notes?: string }).notes ?? "";
                      return (
                        <li
                          key={item.id}
                          className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-black/30 px-3 py-2.5"
                        >
                          <span className="shrink-0 rounded-lg bg-cyan-500 px-2 py-0.5 text-lg font-black leading-tight text-black">
                            {item.quantity}x
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-bold leading-snug text-white">
                              {item.product_name}
                            </span>
                            {notes && (
                              <span className="mt-1 block rounded-md bg-amber-500/10 px-2 py-1 text-sm leading-snug text-amber-200">
                                {notes}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {current.observations && (
                  <p className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2 text-sm leading-relaxed text-amber-100">
                    <span className="font-bold">Observação: </span>
                    {current.observations}
                  </p>
                )}

                {current.delivery_type === "entrega" && current.delivery_address && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-gray-400">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    {current.delivery_address}
                  </p>
                )}
              </div>
            )}

            {/* Ações grandes */}
            {!locked && (
              <div className="flex gap-2">
                <button
                  onClick={() => onCancel(current)}
                  className="grid w-16 shrink-0 place-items-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20"
                  aria-label="Cancelar pedido"
                >
                  <XCircle className="size-6" />
                </button>
                {next ? (
                  <button
                    onClick={() => onAdvance(current, next)}
                    className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-500 text-lg font-black uppercase tracking-wide text-black transition-all hover:bg-cyan-400 active:scale-[0.99]"
                  >
                    {ACTION_LABEL[next] ?? ORDER_STATUS_LABELS[next]}
                  </button>
                ) : (
                  <span className="flex h-16 flex-1 items-center justify-center rounded-2xl bg-white/[0.04] text-sm font-bold text-gray-500">
                    Sem próxima etapa
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Próximos da fila */}
      {nextUp.length > 0 && (
        <footer className="shrink-0 border-t border-white/10 bg-black/40 px-4 py-2.5">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-600">
            Na sequência
          </p>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {nextUp.map((o) => {
              const t = orderTimer(o.created_at, now);
              return (
                <div
                  key={o.id}
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5"
                >
                  <span className="font-mono text-xs font-bold text-white">{o.comanda}</span>
                  <span
                    className={cn("text-[11px] font-semibold tabular-nums", TIMER_TONE[t.level])}
                  >
                    {formatElapsed(t.minutes)}
                  </span>
                </div>
              );
            })}
          </div>
        </footer>
      )}
    </div>
  );
}
