import { describe, expect, it } from "vitest";
import { normalizeTrackingOrder } from "./orders";
import { brl } from "@/lib/utils";
import type { Order } from "@/lib/types";

/**
 * Regressão do "Acompanhar pedido": a view/RPC pública de tracking não devolve
 * subtotal/delivery_fee/delivery_type/payment_method. Sem a normalização,
 * `brl(order.subtotal)` recebia `undefined` e derrubava a página inteira.
 */
function trackingRow(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    restaurant_id: "r1",
    comanda: "#7",
    status: "received",
    total: 42.5,
    observations: "",
    created_at: "2026-09-20T12:00:00.000Z",
    order_items: [],
    ...overrides,
  } as Order;
}

describe("normalizeTrackingOrder", () => {
  it("deriva o subtotal do total quando a view não o devolve", () => {
    const order = normalizeTrackingOrder(trackingRow());
    expect(order.subtotal).toBe(42.5);
    expect(Number.isFinite(order.subtotal)).toBe(true);
  });

  it("desconta a taxa de entrega do subtotal quando informada", () => {
    const order = normalizeTrackingOrder(trackingRow({ total: 50, delivery_fee: 8 }));
    expect(order.subtotal).toBe(42);
    expect(order.delivery_fee).toBe(8);
  });

  it("preserva subtotal e taxa quando já vêm preenchidos", () => {
    const order = normalizeTrackingOrder(trackingRow({ total: 50, subtotal: 45, delivery_fee: 5 }));
    expect(order.subtotal).toBe(45);
    expect(order.delivery_fee).toBe(5);
  });

  it("assume retirada quando a view omite o tipo de entrega", () => {
    const order = normalizeTrackingOrder(trackingRow());
    expect(order.delivery_type).toBe("retirada");
    expect(order.payment_method).toBe("");
    expect(order.order_items).toEqual([]);
  });

  it("converte total em string (NUMERIC via JSON) para número", () => {
    const order = normalizeTrackingOrder(trackingRow({ total: "30.25" as unknown as number }));
    expect(order.total).toBe(30.25);
    expect(order.subtotal).toBe(30.25);
  });

  it("permite formatar o subtotal sem estourar (regressão do tracking)", () => {
    const order = normalizeTrackingOrder(trackingRow({ total: 42.5 }));
    // Antes da normalização isto lançava
    // TypeError: Cannot read properties of undefined (reading 'toLocaleString')
    expect(() => brl(order.subtotal)).not.toThrow();
    expect(brl(order.subtotal)).toContain("42,50");
  });
});
