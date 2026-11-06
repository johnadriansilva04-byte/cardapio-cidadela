import { describe, expect, it } from "vitest";
import { parseAiOrder } from "@/api/lib/order-draft";
import {
  matchProduct,
  parseOrderDeterministic,
  reconcileOrderDraft,
  type MenuAddon,
  type MenuProduct,
} from "@/lib/order-draft";

const PRODUCTS: MenuProduct[] = [
  { id: "p1", name: "X-Burger" },
  { id: "p2", name: "X-Burger Especial" },
  { id: "p3", name: "Pizza Calabresa" },
  { id: "p4", name: "Guaraná Lata" },
  { id: "p5", name: "Suco de Laranja" },
];

const ADDONS: MenuAddon[] = [
  { id: "a1", name: "Bacon", product_id: "p1" },
  { id: "a2", name: "Cheddar", product_id: null },
];

describe("matchProduct", () => {
  it("casa pelo nome normalizado (sem acento, minúsculo)", () => {
    expect(matchProduct("quero um guaraná", PRODUCTS)?.id).toBe("p4");
    expect(matchProduct("uma pizza calabresa", PRODUCTS)?.id).toBe("p3");
  });

  it("prefere o nome mais longo quando um contém o outro", () => {
    expect(matchProduct("x-burger especial", PRODUCTS)?.id).toBe("p2");
  });

  it("não casa item fora do cardápio", () => {
    expect(matchProduct("um hot dog", PRODUCTS)).toBeNull();
  });
});

describe("parseOrderDeterministic", () => {
  it("monta o pedido por texto com quantidade e adicionais", () => {
    const r = parseOrderDeterministic("2 x-burger com bacon e um guaraná", PRODUCTS, ADDONS);
    const burger = r.lines.find((l) => l.product_id === "p1");
    expect(burger?.quantity).toBe(2);
    expect(burger?.addon_ids).toContain("a1");
    const guarana = r.lines.find((l) => l.product_id === "p4");
    expect(guarana?.quantity).toBe(1);
    expect(r.ai).toBe(false);
  });

  it("entende quantidade por extenso", () => {
    const r = parseOrderDeterministic("duas pizzas calabresa", PRODUCTS, ADDONS);
    expect(r.lines[0]?.quantity).toBe(2);
  });

  it("captura observação (sem cebola)", () => {
    const r = parseOrderDeterministic("1 x-burger sem cebola", PRODUCTS, ADDONS);
    expect(r.lines[0]?.notes).toMatch(/sem cebola/i);
  });

  it("reporta o que não reconheceu", () => {
    const r = parseOrderDeterministic("um hot dog", PRODUCTS, ADDONS);
    expect(r.lines).toHaveLength(0);
    expect(r.unmatched.join(" ")).toMatch(/hot dog/i);
  });

  it("nunca devolve preço — só ids e quantidade", () => {
    const r = parseOrderDeterministic("2 x-burger", PRODUCTS, ADDONS);
    expect(Object.keys(r.lines[0])).toEqual(
      expect.arrayContaining(["product_id", "quantity", "addon_ids", "notes"]),
    );
    expect(JSON.stringify(r.lines)).not.toMatch(/price|total|valor/i);
  });
});

describe("parseAiOrder + reconcileOrderDraft", () => {
  it("lê o JSON da IA mesmo com prosa em volta", () => {
    const lines = parseAiOrder(
      'Claro! {"lines":[{"product_id":"p1","quantity":2,"addon_ids":["a1"],"notes":"sem cebola"}]}',
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].product_id).toBe("p1");
  });

  it("descarta produto/aditivo que não existe no catálogo", () => {
    const fallback = parseOrderDeterministic("", PRODUCTS, ADDONS);
    const r = reconcileOrderDraft(
      [
        { product_id: "INVENTADO", quantity: 1, addon_ids: [], notes: "" },
        { product_id: "p4", quantity: 1, addon_ids: ["HACK"], notes: "" },
      ],
      fallback,
      PRODUCTS,
      ADDONS,
    );
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].product_id).toBe("p4");
    expect(r.lines[0].addon_ids).toEqual([]);
    expect(r.ai).toBe(true);
  });

  it("cai no determinístico quando a IA não devolve nada válido", () => {
    const fallback = parseOrderDeterministic("um guaraná", PRODUCTS, ADDONS);
    const r = reconcileOrderDraft(
      [{ product_id: "ZZZ", quantity: 1, addon_ids: [], notes: "" }],
      fallback,
      PRODUCTS,
      ADDONS,
    );
    expect(r.ai).toBe(false);
    expect(r.lines[0].product_id).toBe("p4");
  });

  it("limita a quantidade a 50", () => {
    const fallback = parseOrderDeterministic("", PRODUCTS, ADDONS);
    const r = reconcileOrderDraft(
      [{ product_id: "p1", quantity: 9999, addon_ids: [], notes: "" }],
      fallback,
      PRODUCTS,
      ADDONS,
    );
    expect(r.lines[0].quantity).toBe(50);
  });
});
