import { describe, expect, it } from "vitest";
import { cartLineBelongsToOtherRestaurant, deriveCartOwner, shouldResetCart } from "./cartScope";
import type { CartItem, Product } from "./types";

function product(id: string, restaurantId: string): Product {
  return {
    id,
    restaurant_id: restaurantId,
    category_id: "cat-1",
    name: `Produto ${id}`,
    description: "",
    price: 10,
    image_url: "",
    available: true,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function line(id: string, restaurantId: string, quantity = 1): CartItem {
  return { product: product(id, restaurantId), quantity, notes: "" };
}

describe("deriveCartOwner", () => {
  it("retorna null para carrinho vazio", () => {
    expect(deriveCartOwner([])).toBeNull();
  });

  it("usa o restaurant_id da primeira linha com dono", () => {
    expect(deriveCartOwner([line("p1", "rest-a"), line("p2", "rest-b")])).toBe("rest-a");
  });

  it("ignora linha sem restaurant_id e acha a próxima que tem", () => {
    const semDono = { ...line("p1", "x"), product: { ...product("p1", "x"), restaurant_id: "" } };
    expect(deriveCartOwner([semDono, line("p2", "rest-b")])).toBe("rest-b");
  });
});

describe("shouldResetCart", () => {
  it("não mexe em carrinho vazio", () => {
    expect(shouldResetCart([], "rest-b", "rest-a")).toBe(false);
  });

  it("não mexe quando não há restaurante aberto", () => {
    expect(shouldResetCart([line("p1", "rest-a")], null, "rest-a")).toBe(false);
  });

  it("mantém o carrinho do próprio restaurante", () => {
    expect(shouldResetCart([line("p1", "rest-a")], "rest-a", "rest-a")).toBe(false);
  });

  it("descarta carrinho de outro restaurante (o bug do reload direto)", () => {
    expect(shouldResetCart([line("p1", "rest-a")], "rest-b", "rest-a")).toBe(true);
  });

  it("deriva o dono das linhas quando o carrinho é de versão antiga (sem dono gravado)", () => {
    expect(shouldResetCart([line("p1", "rest-a")], "rest-b", null)).toBe(true);
  });

  it("mantém carrinho antigo do mesmo restaurante derivado das linhas", () => {
    expect(shouldResetCart([line("p1", "rest-a")], "rest-a", null)).toBe(false);
  });

  it("não apaga quando o dono não pode ser determinado", () => {
    const orfao = { ...line("p1", "x"), product: { ...product("p1", "x"), restaurant_id: "" } };
    expect(shouldResetCart([orfao], "rest-b", null)).toBe(false);
  });
});

describe("cartLineBelongsToOtherRestaurant", () => {
  it("detecta linha de outro restaurante", () => {
    expect(cartLineBelongsToOtherRestaurant(line("p1", "rest-a"), "rest-b")).toBe(true);
  });

  it("não acusa a linha do próprio restaurante", () => {
    expect(cartLineBelongsToOtherRestaurant(line("p1", "rest-a"), "rest-a")).toBe(false);
  });

  it("não acusa sem restaurante de referência", () => {
    expect(cartLineBelongsToOtherRestaurant(line("p1", "rest-a"), null)).toBe(false);
  });
});
