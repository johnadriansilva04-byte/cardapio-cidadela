import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUSES,
  aggregateCustomers,
  computeMetrics,
  dailyRevenue,
  formatElapsed,
  isActive,
  isFinished,
  NEXT_STATUS,
  orderTimer,
  trackingUrl,
} from "@/modules/mobile/orders";
import type { Order, OrderStatus } from "@/lib/types";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    restaurant_id: "r1",
    customer_id: null,
    idempotency_key: null,
    comanda: "#1",
    customer_name: "Ana",
    customer_phone: "11999999999",
    customer_email: "",
    delivery_address: "Rua A, 10",
    customer_complement: "",
    customer_neighborhood: "Centro",
    customer_city: "Cidade",
    delivery_type: "entrega",
    observations: "",
    subtotal: 30,
    delivery_fee: 5,
    total: 35,
    payment_method: "pix",
    payment_status: "pending",
    status: "received",
    cidadela_unlocked: false,
    created_at: "2026-09-19T12:00:00.000Z",
    updated_at: "2026-09-19T12:00:00.000Z",
    ...overrides,
  };
}

describe("status helpers", () => {
  it("classifica status ativos e finalizados", () => {
    for (const status of ACTIVE_STATUSES) expect(isActive(status)).toBe(true);
    expect(isFinished("delivered")).toBe(true);
    expect(isFinished("cancelled")).toBe(true);
    expect(isActive("delivered")).toBe(false);
    expect(isFinished("received")).toBe(false);
  });

  it("mapeia o próximo passo do fluxo operacional", () => {
    expect(NEXT_STATUS.received).toBe("preparing");
    expect(NEXT_STATUS.ready).toBe("out_for_delivery");
    expect(NEXT_STATUS.delivered).toBeNull();
    expect(NEXT_STATUS.cancelled).toBeNull();
  });
});

describe("trackingUrl", () => {
  it("aponta para a rota pública de acompanhamento", () => {
    expect(trackingUrl("abc")).toContain("/pedido/abc");
  });
});

describe("orderTimer", () => {
  const created = "2026-09-19T12:00:00.000Z";

  it("conta minutos e escolhe a faixa de urgência", () => {
    const base = new Date(created).getTime();
    expect(orderTimer(created, base + 5 * 60000).level).toBe("fresh");
    expect(orderTimer(created, base + 20 * 60000).level).toBe("attention");
    expect(orderTimer(created, base + 45 * 60000).level).toBe("late");
  });

  it("nunca fica negativo com clock adiantado", () => {
    const base = new Date(created).getTime();
    expect(orderTimer(created, base - 60000).minutes).toBe(0);
  });

  it("trata data inválida como zero", () => {
    expect(orderTimer("nao-e-data", Date.now()).minutes).toBe(0);
  });

  it("formata minutos e horas", () => {
    expect(formatElapsed(0)).toBe("0 min");
    expect(formatElapsed(59)).toBe("59 min");
    expect(formatElapsed(60)).toBe("1h");
    expect(formatElapsed(75)).toBe("1h15");
  });
});

describe("aggregateCustomers", () => {
  it("soma pedidos por telefone e ordena por gasto", () => {
    const orders = [
      makeOrder({ id: "a", customer_phone: "11", total: 10 }),
      makeOrder({ id: "b", customer_phone: "11", total: 25 }),
      makeOrder({ id: "c", customer_phone: "22", total: 100 }),
    ];
    const result = aggregateCustomers(orders);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ key: "22", totalOrders: 1, totalSpent: 100 });
    expect(result[1]).toMatchObject({ key: "11", totalOrders: 2, totalSpent: 35 });
  });

  it("cai para o nome quando não há telefone", () => {
    const orders = [makeOrder({ id: "a", customer_phone: "", customer_name: "Bia" })];
    expect(aggregateCustomers(orders)[0].key).toBe("Bia");
  });
});

describe("dailyRevenue", () => {
  it("cria buckets vazios para todos os dias e soma no dia local correto", () => {
    const now = new Date(2026, 8, 19, 12, 0, 0);
    const orders = [
      makeOrder({ id: "a", created_at: new Date(2026, 8, 19, 9, 0, 0).toISOString(), total: 40 }),
      makeOrder({ id: "b", created_at: new Date(2026, 8, 18, 22, 0, 0).toISOString(), total: 60 }),
    ];
    const week = dailyRevenue(orders, 7, now);
    expect(week).toHaveLength(7);
    expect(week.at(-1)).toMatchObject({ label: "19/09", value: 40 });
    expect(week.at(-2)).toMatchObject({ label: "18/09", value: 60 });
  });

  it("ignora datas inválidas", () => {
    const week = dailyRevenue([makeOrder({ created_at: "x" })], 3, new Date(2026, 8, 19));
    expect(week.reduce((sum, day) => sum + day.value, 0)).toBe(0);
  });
});

describe("computeMetrics", () => {
  const names = new Map([["r1", "Loja A"]]);

  it("agrega receita, ticket médio e distribuição de status", () => {
    const orders = [
      makeOrder({ id: "a", status: "received", total: 10 }),
      makeOrder({ id: "b", status: "delivered", total: 30 }),
      makeOrder({ id: "c", status: "cancelled", total: 20 }),
    ];
    const metrics = computeMetrics(orders, names, new Date("2026-09-19T12:00:00.000Z"));
    expect(metrics.totalOrders).toBe(3);
    expect(metrics.totalRevenue).toBe(60);
    expect(metrics.averageTicket).toBe(20);
    expect(metrics.activeCount).toBe(1);
    expect(metrics.finishedCount).toBe(1);
    expect(metrics.cancelledCount).toBe(1);
    expect(metrics.todayRevenue).toBe(60);
    expect(metrics.statusDistribution[0].value).toBe(1);
    expect(metrics.topRestaurants[0]).toMatchObject({ name: "Loja A", orders: 3, revenue: 60 });
  });

  it("não divide por zero sem pedidos", () => {
    expect(computeMetrics([], names).averageTicket).toBe(0);
  });

  it("usa nome genérico quando o restaurante não é conhecido", () => {
    const metrics = computeMetrics([makeOrder()], new Map());
    expect(metrics.topRestaurants[0].name).toBe("Restaurante");
  });

  it("conta somente o dia local no recorte de hoje", () => {
    const now = new Date(2026, 8, 19, 12, 0, 0);
    const orders = [
      makeOrder({ id: "a", created_at: new Date(2026, 8, 19, 1, 0, 0).toISOString(), total: 5 }),
      makeOrder({ id: "b", created_at: new Date(2026, 8, 18, 23, 0, 0).toISOString(), total: 7 }),
    ];
    const metrics = computeMetrics(orders, new Map(), now);
    expect(metrics.todayOrders).toBe(1);
    expect(metrics.todayRevenue).toBe(5);
  });
});

describe("status labels", () => {
  it("tem rótulo para todo status", () => {
    const statuses: OrderStatus[] = [
      "received",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ];
    for (const status of statuses) expect(NEXT_STATUS[status]).toBeDefined();
  });
});
