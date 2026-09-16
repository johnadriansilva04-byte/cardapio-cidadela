import type { Order, OrderStatus } from "@/lib/types";
import { nextStatusFor } from "@/lib/orderFlow";

export const ACTIVE_STATUSES: OrderStatus[] = [
  "received",
  "preparing",
  "ready",
  "out_for_delivery",
];

export const FINISHED_STATUSES: OrderStatus[] = ["delivered", "cancelled"];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Recebido",
  preparing: "Preparando",
  ready: "Pronto",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

/** Próximo passo natural do fluxo — delega para o helper compartilhado. */
export function nextStatus(order: Order): OrderStatus | null {
  return nextStatusFor(order);
}

export function isActive(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function isFinished(status: OrderStatus): boolean {
  return FINISHED_STATUSES.includes(status);
}

/** Link público de acompanhamento enviado ao cliente. */
export function trackingUrl(orderId: string): string {
  const path = `/pedido/${orderId}`;
  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export interface OrderTimerState {
  /** Minutos corridos desde a criação do pedido. */
  minutes: number;
  /** Faixa de urgência, usada para colorir o indicador. */
  level: "fresh" | "attention" | "late";
}

/**
 * Quanto tempo o pedido está parado. A faixa "late" existe para o operador
 * enxergar o que passou do aceitável sem precisar comparar horários na mão.
 */
export function orderTimer(createdAt: string, now: number = Date.now()): OrderTimerState {
  const created = new Date(createdAt).getTime();
  const minutes = Number.isFinite(created) ? Math.max(0, Math.floor((now - created) / 60000)) : 0;
  const level = minutes >= 45 ? "late" : minutes >= 20 ? "attention" : "fresh";
  return { minutes, level };
}

export function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

export interface CustomerStats {
  key: string;
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastOrder: string;
}

/**
 * Agrupa pedidos por cliente (telefone quando existe, senão nome).
 * Cancelados ficam fora: gasto e ticket médio por cliente seguem a mesma regra
 * de faturamento do painel — cancelado não é receita.
 */
export function aggregateCustomers(orders: Order[]): CustomerStats[] {
  const map = new Map<string, CustomerStats>();

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const key = order.customer_phone?.trim() || order.customer_name?.trim() || order.id;
    const existing = map.get(key);
    if (existing) {
      existing.totalOrders += 1;
      existing.totalSpent += Number(order.total) || 0;
      if (new Date(order.created_at) > new Date(existing.lastOrder)) {
        existing.lastOrder = order.created_at;
      }
      if (!existing.address && order.delivery_address) existing.address = order.delivery_address;
      map.set(key, existing);
      continue;
    }
    map.set(key, {
      key,
      name: order.customer_name,
      phone: order.customer_phone ?? "",
      address: order.delivery_address ?? "",
      totalOrders: 1,
      totalSpent: Number(order.total) || 0,
      lastOrder: order.created_at,
    });
  }

  return [...map.values()].sort((a, b) => b.totalSpent - a.totalSpent);
}

export interface DayRevenue {
  /** Chave ISO local (YYYY-MM-DD) — evita o deslocamento de fuso do toISOString(). */
  key: string;
  label: string;
  value: number;
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Faturamento dos últimos `days` dias, incluindo hoje.
 * Usa a data local do navegador para não jogar pedidos da noite para o dia anterior.
 * Cancelados ficam fora — é gráfico de faturamento, não de volume.
 */
export function dailyRevenue(orders: Order[], days = 7, now: Date = new Date()): DayRevenue[] {
  const buckets = new Map<string, number>();

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    buckets.set(localDateKey(date), 0);
  }

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const created = new Date(order.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const key = localDateKey(created);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + (Number(order.total) || 0));
  }

  return [...buckets.entries()].map(([key, value]) => {
    const [, month, day] = key.split("-");
    return { key, label: `${day}/${month}`, value };
  });
}

export interface OrderMetrics {
  totalOrders: number;
  totalRevenue: number;
  cancelledRevenue: number;
  averageTicket: number;
  activeCount: number;
  finishedCount: number;
  cancelledCount: number;
  todayRevenue: number;
  todayOrders: number;
  statusDistribution: { status: OrderStatus; label: string; value: number }[];
  topRestaurants: { name: string; orders: number; revenue: number }[];
}

/**
 * Indicadores do período.
 *
 * Pedido cancelado nunca entra em faturamento nem em ticket médio — a mesma
 * regra do painel admin (`/admin/financeiro`), para que mobile e desktop não
 * mostrem números diferentes para a mesma loja.
 */
export function computeMetrics(
  orders: Order[],
  restaurantNames: Map<string, string> = new Map(),
  now: Date = new Date(),
): OrderMetrics {
  const todayKey = localDateKey(now);

  let totalRevenue = 0;
  let cancelledRevenue = 0;
  let todayRevenue = 0;
  let todayOrders = 0;
  const statusCount = new Map<OrderStatus, number>();
  const byRestaurant = new Map<string, { orders: number; revenue: number }>();

  for (const order of orders) {
    const total = Number(order.total) || 0;
    const isCancelled = order.status === "cancelled";
    if (isCancelled) cancelledRevenue += total;
    else totalRevenue += total;

    statusCount.set(order.status, (statusCount.get(order.status) ?? 0) + 1);

    const created = new Date(order.created_at);
    if (!Number.isNaN(created.getTime()) && localDateKey(created) === todayKey) {
      if (!isCancelled) {
        todayRevenue += total;
        todayOrders += 1;
      }
    }

    if (isCancelled) continue;
    const entry = byRestaurant.get(order.restaurant_id) ?? { orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += total;
    byRestaurant.set(order.restaurant_id, entry);
  }

  const statusDistribution = [...statusCount.entries()]
    .map(([status, value]) => ({ status, label: STATUS_LABELS[status], value }))
    .sort((a, b) => b.value - a.value);

  const topRestaurants = [...byRestaurant.entries()]
    .map(([id, data]) => ({
      name: restaurantNames.get(id) ?? "Restaurante",
      orders: data.orders,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const billableCount = orders.length - (statusCount.get("cancelled") ?? 0);

  return {
    totalOrders: orders.length,
    totalRevenue,
    cancelledRevenue,
    averageTicket: billableCount > 0 ? totalRevenue / billableCount : 0,
    activeCount: orders.filter((o) => isActive(o.status)).length,
    finishedCount: orders.filter((o) => o.status === "delivered").length,
    cancelledCount: statusCount.get("cancelled") ?? 0,
    todayRevenue,
    todayOrders,
    statusDistribution,
    topRestaurants,
  };
}
