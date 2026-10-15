import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { maybeAutoPrintOrder, isAutoPrintEnabled } from "./autoPrint";
import { savePreference } from "./preferences";
import type { Order } from "@/lib/types";

function makeOrder(id: string, withItems = true): Order {
  return {
    id,
    restaurant_id: "rest-1",
    comanda: `#${id}`,
    customer_name: "Cliente Teste",
    customer_phone: "11999990000",
    customer_email: "",
    delivery_address: "Rua Teste, 1",
    delivery_type: "retirada",
    observations: "",
    subtotal: 18.5,
    delivery_fee: 0,
    total: 18.5,
    payment_method: "pix",
    payment_status: "pending",
    status: "received",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    cidadela_unlocked: false,
    order_items: withItems
      ? [
          {
            id: "i1",
            order_id: id,
            product_id: "p1",
            product_name: "X-Burger Especial",
            quantity: 1,
            unit_price: 18.5,
            total: 18.5,
            notes: "sem cebola",
          },
        ]
      : [],
  } as unknown as Order;
}

/** Comandas impressas = iframes injetados no body pelo `printTicket`. */
function printedFrames(): HTMLIFrameElement[] {
  return Array.from(document.body.querySelectorAll("iframe"));
}

beforeEach(() => {
  document.body.innerHTML = "";
  savePreference("autoPrint", false);
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("autoPrint", () => {
  it("não imprime quando a preferência está desligada", () => {
    const fired = maybeAutoPrintOrder(makeOrder("o1"), "Loja");
    expect(fired).toBe(false);
    expect(printedFrames()).toHaveLength(0);
  });

  it("imprime a comanda com os itens quando ligado", () => {
    savePreference("autoPrint", true);
    expect(isAutoPrintEnabled()).toBe(true);

    const fired = maybeAutoPrintOrder(makeOrder("o2"), "Loja Teste");
    expect(fired).toBe(true);

    const frames = printedFrames();
    expect(frames).toHaveLength(1);
    // O conteúdo da comanda vai para o iframe — precisa conter o produto e a loja.
    const html = frames[0].contentDocument?.body?.innerHTML ?? "";
    expect(html).toContain("X-Burger Especial");
    expect(html).toContain("LOJA TESTE");
  });

  it("deduplica: o mesmo pedido não imprime duas vezes", () => {
    savePreference("autoPrint", true);
    const order = makeOrder("o3");

    expect(maybeAutoPrintOrder(order, "Loja")).toBe(true);
    expect(maybeAutoPrintOrder(order, "Loja")).toBe(false);
    expect(printedFrames()).toHaveLength(1);
  });
});
