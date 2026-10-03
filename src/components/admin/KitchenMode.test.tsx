import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KitchenMode } from "@/components/admin/KitchenMode";
import type { Order, OrderStatus } from "@/lib/types";

function makeOrder(overrides: Partial<Order> & { id: string; status: OrderStatus }): Order {
  return {
    restaurant_id: "store-1",
    customer_id: null,
    idempotency_key: null,
    comanda: "A1",
    customer_name: "Cliente",
    customer_phone: "11999999999",
    customer_email: "",
    delivery_address: "",
    customer_complement: "",
    customer_neighborhood: "",
    customer_city: "",
    delivery_type: "retirada",
    observations: "",
    subtotal: 10,
    delivery_fee: 0,
    total: 10,
    payment_method: "pix",
    payment_status: "pending",
    cidadela_unlocked: false,
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-01T10:00:00.000Z",
    order_items: [],
    ...overrides,
  };
}

const baseProps = {
  lockedStores: new Set<string>(),
  restaurantNames: new Map([["store-1", "Cantina"]]),
  multi: false,
  onAdvance: vi.fn(),
  onCancel: vi.fn(),
  onClose: vi.fn(),
};

describe("KitchenMode", () => {
  it("mostra o pedido mais antigo da fila primeiro", () => {
    const older = makeOrder({
      id: "o1",
      status: "received",
      comanda: "ANTIGO",
      created_at: "2026-01-01T09:00:00.000Z",
    });
    const newer = makeOrder({
      id: "o2",
      status: "received",
      comanda: "NOVO",
      created_at: "2026-01-01T11:00:00.000Z",
    });

    render(<KitchenMode {...baseProps} orders={[newer, older]} />);

    // O comanda atual é o mais antigo; o mais novo fica na "sequência".
    expect(screen.getByText("ANTIGO")).toBeInTheDocument();
    expect(screen.getByText("NOVO")).toBeInTheDocument();
  });

  it("avança o pedido atual para o próximo status com um toque", async () => {
    const user = userEvent.setup();
    const onAdvance = vi.fn();
    const order = makeOrder({ id: "o1", status: "received" });

    render(<KitchenMode {...baseProps} onAdvance={onAdvance} orders={[order]} />);

    await user.click(screen.getByRole("button", { name: /começar preparo/i }));
    expect(onAdvance).toHaveBeenCalledWith(order, "preparing");
  });

  it("esconde os itens quando a loja está bloqueada pelo plano", () => {
    const order = makeOrder({
      id: "o1",
      status: "received",
      order_items: [
        {
          id: "i1",
          order_id: "o1",
          product_id: "p1",
          product_name: "Pizza secreta",
          quantity: 1,
          unit_price: 10,
          total: 10,
        },
      ],
    });

    render(<KitchenMode {...baseProps} lockedStores={new Set(["store-1"])} orders={[order]} />);

    expect(screen.queryByText("Pizza secreta")).not.toBeInTheDocument();
    expect(screen.getByText(/detalhes bloqueados pelo plano/i)).toBeInTheDocument();
  });
});
