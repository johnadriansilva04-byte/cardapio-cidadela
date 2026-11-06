import { describe, expect, it } from "vitest";
import { parseMenuScan, normalizePrice } from "@/api/lib/menu-extract";

describe("parseMenuScan", () => {
  it("lê categorias e produtos", () => {
    const out = parseMenuScan({
      categories: [
        {
          name: "Lanches",
          products: [
            { name: "X-Burger", price: 18.5, description: "pão, carne e queijo" },
            { name: "X-Salada", price: 20 },
          ],
        },
        { name: "Bebidas", products: [{ name: "Coca-Cola", price: 6 }] },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("Lanches");
    expect(out[0].products[0]).toEqual({
      name: "X-Burger",
      price: 18.5,
      description: "pão, carne e queijo",
    });
    expect(out[1].products[0].name).toBe("Coca-Cola");
  });

  it("descarta produto sem nome e categoria sem produto", () => {
    const out = parseMenuScan({
      categories: [
        { name: "Vazia", products: [] },
        { name: "Bebidas", products: [{ price: 5 }, { name: "Suco", price: 7 }] },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Bebidas");
    expect(out[0].products).toHaveLength(1);
  });

  it("usa 'Cardápio' quando a categoria não tem nome", () => {
    const out = parseMenuScan({ categories: [{ products: [{ name: "Prato", price: 10 }] }] });
    expect(out[0].name).toBe("Cardápio");
  });

  it("preço inválido vira 0", () => {
    const out = parseMenuScan({
      categories: [{ name: "X", products: [{ name: "A", price: "abc" }, { name: "B" }] }],
    });
    expect(out[0].products[0].price).toBe(0);
    expect(out[0].products[1].price).toBe(0);
  });

  it("aceita preço em string com vírgula", () => {
    const out = parseMenuScan({
      categories: [{ name: "X", products: [{ name: "A", price: "18,50" }] }],
    });
    expect(out[0].products[0].price).toBe(18.5);
  });

  it("limita a 40 itens no total", () => {
    const products = Array.from({ length: 60 }, (_, i) => ({ name: `Item ${i}`, price: 1 }));
    const out = parseMenuScan({ categories: [{ name: "Tudo", products }] });
    const total = out.reduce((n, c) => n + c.products.length, 0);
    expect(total).toBe(40);
  });

  it("devolve [] para entrada inválida", () => {
    expect(parseMenuScan(null)).toEqual([]);
    expect(parseMenuScan({})).toEqual([]);
    expect(parseMenuScan({ categories: "nope" })).toEqual([]);
  });
});

describe("normalizePrice", () => {
  it("arredonda para 2 casas e rejeita fora de faixa", () => {
    expect(normalizePrice(12.345)).toBe(12.35);
    expect(normalizePrice(-1)).toBe(0);
    expect(normalizePrice(100000)).toBe(0);
    expect(normalizePrice(0)).toBe(0);
  });
});
