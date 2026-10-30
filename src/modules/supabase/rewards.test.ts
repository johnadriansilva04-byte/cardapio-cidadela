import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("./client", () => ({ supabase: { rpc: mocks.rpc } }));

import { fetchBonusOrders, fetchRewards, bumpUsage, fetchUsageSeconds } from "./rewards";

describe("rewards client", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lê o saldo de bônus", async () => {
    mocks.rpc.mockResolvedValue({ data: 12, error: null });
    expect(await fetchBonusOrders("s1")).toBe(12);
    expect(mocks.rpc).toHaveBeenCalledWith("owner_bonus_orders", { p_store: "s1" });
  });

  it("devolve 0 quando a RPC de bônus falha", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "nope" } });
    expect(await fetchBonusOrders("s1")).toBe(0);
  });

  it("normaliza a lista de metas", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          reward_id: "r1",
          title: "Liga 20h",
          metric: "usage_seconds",
          threshold: "72000",
          bonus_orders: "0",
          day_credits: "5",
          progress: "3600",
          granted: false,
        },
      ],
      error: null,
    });

    const rewards = await fetchRewards("s1");
    expect(rewards).toEqual([
      {
        reward_id: "r1",
        title: "Liga 20h",
        metric: "usage_seconds",
        threshold: 72000,
        bonus_orders: 0,
        day_credits: 5,
        progress: 3600,
        granted: false,
      },
    ]);
  });

  it("devolve [] quando owner_rewards falha", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "nope" } });
    expect(await fetchRewards("s1")).toEqual([]);
  });

  it("envia o batimento arredondado e limita a 0 no mínimo", async () => {
    mocks.rpc.mockResolvedValue({ data: 90, error: null });
    await bumpUsage("s1", 60.6);
    expect(mocks.rpc).toHaveBeenCalledWith("bump_store_usage", { p_store: "s1", p_seconds: 61 });
    await bumpUsage("s1", -5);
    expect(mocks.rpc).toHaveBeenCalledWith("bump_store_usage", { p_store: "s1", p_seconds: 0 });
  });

  it("lê os segundos de uso", async () => {
    mocks.rpc.mockResolvedValue({ data: 7200, error: null });
    expect(await fetchUsageSeconds("s1")).toBe(7200);
  });
});
