import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Precificação autoritativa: o que o cliente envia (unit_price/total) é
 * ignorado; o servidor recalcula a partir de products/product_addons/
 * delivery_neighborhoods. Estes testes cobrem a regressão do pedido forjado
 * (preço/total inventados no navegador).
 */

type Result = { data: unknown; error: { message: string } | null };

const mocks = vi.hoisted(() => {
  const tables: Record<string, Result> = {
    products: { data: [], error: null },
    product_addons: { data: [], error: null },
    restaurants: { data: null, error: null },
    delivery_neighborhoods: { data: [], error: null },
  };
  return { tables };
});

function makeQuery(table: string) {
  const result = () => mocks.tables[table];
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    in: () => q,
    maybeSingle: () => Promise.resolve(result()),
    then: (resolve: (v: Result) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return q;
}

vi.mock("./client", () => ({
  supabase: { from: (table: string) => makeQuery(table) },
}));

import { resolveOrderPricing, PricingError } from "./pricing";

describe("resolveOrderPricing", () => {
  beforeEach(() => {
    mocks.tables.products = {
      data: [
        { id: "p1", name: "X-Burger", price: 18.9, available: true },
        { id: "p2", name: "Coca", price: 5.9, available: true },
      ],
      error: null,
    };
    mocks.tables.product_addons = {
      data: [
        { id: "a1", name: "Bacon", price: 3.5, restaurant_id: "r1" },
        { id: "a2", name: "Outro restaurante", price: 99, restaurant_id: "r2" },
      ],
      error: null,
    };
    mocks.tables.restaurants = { data: { delivery_fee: 8 }, error: null };
    mocks.tables.delivery_neighborhoods = { data: [], error: null };
  });

  it("ignora o preço enviado e usa o preço do banco", async () => {
    const result = await resolveOrderPricing({
      restaurantId: "r1",
      delivery_type: "retirada",
      items: [
        // Preço forjado de R$ 0,01 — deve ser descartado.
        { product_id: "p1", quantity: 2, unit_price: 0.01, total: 0.02 } as never,
      ],
    });

    expect(result.items[0].unit_price).toBe(18.9);
    expect(result.items[0].total).toBe(37.8);
    expect(result.subtotal).toBe(37.8);
    expect(result.total).toBe(37.8);
  });

  it("soma adicionais do próprio restaurante e ignora os de outro", async () => {
    const result = await resolveOrderPricing({
      restaurantId: "r1",
      delivery_type: "retirada",
      items: [{ product_id: "p1", quantity: 1, addon_ids: ["a1", "a2"] }],
    });

    expect(result.items[0].unit_price).toBe(22.4); // 18.9 + 3.5
    expect(result.items[0].product_name).toContain("Bacon");
    expect(result.items[0].product_name).not.toContain("Outro restaurante");
  });

  it("rejeita item indisponível", async () => {
    mocks.tables.products = {
      data: [{ id: "p1", name: "X-Burger", price: 18.9, available: false }],
      error: null,
    };

    await expect(
      resolveOrderPricing({
        restaurantId: "r1",
        delivery_type: "retirada",
        items: [{ product_id: "p1", quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(PricingError);
  });

  it("rejeita item que não pertence ao restaurante", async () => {
    await expect(
      resolveOrderPricing({
        restaurantId: "r1",
        delivery_type: "retirada",
        items: [{ product_id: "inexistente", quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(PricingError);
  });

  it("cobra a taxa do bairro quando informado", async () => {
    mocks.tables.delivery_neighborhoods = {
      data: [
        { name: "Centro", fee: 5 },
        { name: "Zona Sul", fee: 12 },
      ],
      error: null,
    };

    const result = await resolveOrderPricing({
      restaurantId: "r1",
      delivery_type: "entrega",
      customer_neighborhood: "zona sul",
      items: [{ product_id: "p2", quantity: 1 }],
    });

    expect(result.subtotal).toBe(5.9);
    expect(result.delivery_fee).toBe(12);
    expect(result.total).toBe(17.9);
  });

  it("não casa bairro por curinga (proteção contra % no ilike)", async () => {
    mocks.tables.delivery_neighborhoods = {
      data: [{ name: "Zona Sul", fee: 12 }],
      error: null,
    };

    const result = await resolveOrderPricing({
      restaurantId: "r1",
      delivery_type: "entrega",
      customer_neighborhood: "%",
      items: [{ product_id: "p2", quantity: 1 }],
    });

    // Sem match exato, cai na taxa fixa do restaurante.
    expect(result.delivery_fee).toBe(8);
  });

  it("retirada nunca cobra taxa de entrega", async () => {
    const result = await resolveOrderPricing({
      restaurantId: "r1",
      delivery_type: "retirada",
      items: [{ product_id: "p2", quantity: 1 }],
    });
    expect(result.delivery_fee).toBe(0);
    expect(result.total).toBe(5.9);
  });
});
