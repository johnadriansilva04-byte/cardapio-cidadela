import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("./client", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));

import { checkSubscriptionStatus, checkMonthlyLimit, MONTHLY_FREE_LIMIT } from "./subscription";

/** Builder mínimo para `from("admin_trials").select().eq().maybeSingle()`. */
function trialsRow(row: Record<string, unknown> | null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
    update: () => chain,
  };
  return chain;
}

describe("cota com pedidos bônus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue(trialsRow(null));
  });

  it("soma o bônus à cota do plano gratuito", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "owner_monthly_order_count") return Promise.resolve({ data: 3, error: null });
      if (name === "owner_bonus_orders") return Promise.resolve({ data: 20, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const status = await checkSubscriptionStatus("store-1");

    expect(status.bonusOrders).toBe(20);
    expect(status.monthlyLimit).toBe(MONTHLY_FREE_LIMIT + 20);
    expect(status.remainingOrders).toBe(MONTHLY_FREE_LIMIT + 20 - 3);
  });

  it("degrada para a cota padrão quando a RPC de bônus não existe", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "owner_monthly_order_count") return Promise.resolve({ data: 1, error: null });
      // Migração não aplicada: a RPC devolve erro.
      return Promise.resolve({ data: null, error: { message: "function does not exist" } });
    });

    const status = await checkSubscriptionStatus("store-1");

    expect(status.bonusOrders).toBe(0);
    expect(status.monthlyLimit).toBe(MONTHLY_FREE_LIMIT);
    expect(status.remainingOrders).toBe(MONTHLY_FREE_LIMIT - 1);
  });

  it("libera o pedido quando o bônus cobre o consumo acima da cota", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "owner_monthly_order_count") return Promise.resolve({ data: 7, error: null });
      if (name === "owner_bonus_orders") return Promise.resolve({ data: 5, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const limit = await checkMonthlyLimit("store-1");

    // 7 pedidos > 5 da cota padrão, mas o bônus de 5 eleva o teto para 10.
    expect(limit.allowed).toBe(true);
    expect(limit.remaining).toBe(3);
  });

  it("bloqueia quando o consumo ultrapassa cota + bônus", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "owner_monthly_order_count") return Promise.resolve({ data: 11, error: null });
      if (name === "owner_bonus_orders") return Promise.resolve({ data: 5, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const limit = await checkMonthlyLimit("store-1");

    expect(limit.allowed).toBe(false);
    expect(limit.remaining).toBe(0);
  });
});
