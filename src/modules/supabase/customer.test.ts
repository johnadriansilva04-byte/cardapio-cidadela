import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getMyOrders: vi.fn(),
}));

vi.mock("./client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/lib/guestOrder", () => ({ getMyOrders: mocks.getMyOrders }));

import { getCustomerOrders } from "./customer";

describe("getCustomerOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMyOrders.mockResolvedValue([]);
  });

  it("usa o guest id do navegador quando não há conta", async () => {
    const guest = [{ id: "g1", total: 10 }];
    mocks.getMyOrders.mockResolvedValue(guest);

    const result = await getCustomerOrders(null);

    expect(result).toBe(guest);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("lê o histórico da conta pela RPC get_my_orders", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: "o1",
          restaurant_id: "r1",
          restaurant_name: "Cidadela",
          comanda: "#7",
          status: "delivered",
          total: "42.5",
          delivery_type: null,
          payment_method: null,
          created_at: "2026-09-20T12:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await getCustomerOrders("u1");

    expect(mocks.rpc).toHaveBeenCalledWith("get_my_orders");
    expect(result).toEqual([
      {
        id: "o1",
        restaurant_id: "r1",
        restaurant_name: "Cidadela",
        comanda: "#7",
        status: "delivered",
        total: 42.5,
        delivery_type: "retirada",
        payment_method: "pix",
        created_at: "2026-09-20T12:00:00.000Z",
      },
    ]);
  });

  it("mantém o fallback do navegador quando a RPC falha (schema antigo)", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });
    const guest = [{ id: "g1", total: 5 }];
    mocks.getMyOrders.mockResolvedValue(guest);

    const result = await getCustomerOrders("u1");

    expect(result).toBe(guest);
  });

  it("respeita histórico vazio da conta em vez de cair no guest", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    const result = await getCustomerOrders("u1");

    expect(result).toEqual([]);
    expect(mocks.getMyOrders).not.toHaveBeenCalled();
  });
});
