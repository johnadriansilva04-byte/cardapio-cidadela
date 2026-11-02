import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Order, OrderStatus } from "@/lib/types";

// O OrderManager é testado com os módulos de dados mockados: o alvo aqui é a
// contagem das abas, não o Supabase. Sem o mock, o `client` tentaria abrir um
// WebSocket no jsdom.
const orders: Order[] = [];

vi.mock("@/modules/supabase/orders", () => ({
  getOrdersByRestaurant: vi.fn(async () => orders),
  getOwnerLockedStores: vi.fn(async () => new Set<string>()),
  getOrderForOwner: vi.fn(async () => ({ blocked: false, order: null })),
  updateOrderStatus: vi.fn(async () => true),
}));

vi.mock("@/modules/supabase/client", () => ({
  supabase: {
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), unsubscribe: () => {} }),
    removeChannel: () => {},
  },
}));

// A rota `/admin/pedidos` importa o Link do router; aqui basta um stub.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { OrderManager } from "@/components/admin/OrderManager";

function makeOrder(id: string, status: OrderStatus, comanda: string): Order {
  return {
    id,
    restaurant_id: "store-1",
    customer_id: null,
    idempotency_key: null,
    comanda,
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
    status,
  };
}

const restaurant = {
  id: "store-1",
  name: "Cantina",
  slug: "cantina",
} as unknown as import("@/lib/types").Restaurant;

/** Conta da aba cujo rótulo é `label`, lendo o número que a acompanha. */
function tabCount(label: string): number {
  const button = screen.getByRole("button", { name: new RegExp(label, "i") });
  const match = button.textContent?.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : -1;
}

describe("OrderManager — contagem das abas", () => {
  beforeEach(() => {
    orders.length = 0;
  });

  it("mostra a contagem de TODAS as abas, não só a ativa", async () => {
    orders.push(
      makeOrder("o1", "received", "A1"),
      makeOrder("o2", "received", "A2"),
      makeOrder("o3", "preparing", "A3"),
    );

    render(<OrderManager restaurants={[restaurant]} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Recebidos/i })).toBeInTheDocument(),
    );

    // O bug: contar sobre a lista já filtrada pelo status ativo zerava o resto.
    expect(tabCount("Recebidos")).toBe(2);
    expect(tabCount("Em preparo")).toBe(1);
    expect(tabCount("Prontos")).toBe(0);
    expect(tabCount("Todos")).toBe(3);
  });

  it("move o número de uma aba para a outra ao avançar o pedido", async () => {
    orders.push(makeOrder("o1", "received", "A1"));

    render(<OrderManager restaurants={[restaurant]} />);

    await waitFor(() => expect(tabCount("Recebidos")).toBe(1));
    expect(tabCount("Em preparo")).toBe(0);

    const advance = await screen.findByRole("button", { name: /Começar preparo/i });
    await userEvent.click(advance);

    await waitFor(() => expect(tabCount("Em preparo")).toBe(1));
    expect(tabCount("Recebidos")).toBe(0);
  });
});
