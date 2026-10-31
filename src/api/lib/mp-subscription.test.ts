import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyApprovedPayment } from "./mp-subscription";

function fakeSupabase(upsert: ReturnType<typeof vi.fn>): SupabaseClient {
  return { from: () => ({ upsert }) } as unknown as SupabaseClient;
}

describe("applyApprovedPayment", () => {
  it("ativa Premium por 1 ano para o store do external_reference", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const result = await applyApprovedPayment(fakeSupabase(upsert), {
      id: "185834592921",
      status: "approved",
      externalReference: "8956f83c-f65e-41a1-b524-56c4434aa9a1",
      dateApproved: null,
    });

    expect(result.premium).toBe(true);
    const [row, opts] = upsert.mock.calls[0];
    expect(row.store_id).toBe("8956f83c-f65e-41a1-b524-56c4434aa9a1");
    expect(row.is_premium).toBe(true);
    expect(new Date(row.premium_expires_at).getFullYear()).toBeGreaterThan(
      new Date().getFullYear(),
    );
    expect(opts).toEqual({ onConflict: "store_id" });
  });

  it("ignora pagamento não aprovado", async () => {
    const upsert = vi.fn();
    const result = await applyApprovedPayment(fakeSupabase(upsert), {
      id: "1",
      status: "pending",
      externalReference: "store-1",
      dateApproved: null,
    });
    expect(result.premium).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("recusa external_reference com e-mail (não é store_id)", async () => {
    const upsert = vi.fn();
    const result = await applyApprovedPayment(fakeSupabase(upsert), {
      id: "1",
      status: "approved",
      externalReference: "alguem@exemplo.com",
      dateApproved: null,
    });
    expect(result.premium).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("ativa Premium por ~30 dias quando kind é 'monthly'", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const result = await applyApprovedPayment(fakeSupabase(upsert), {
      id: "p-mensal",
      status: "approved",
      externalReference: "store-mensal",
      dateApproved: null,
      kind: "monthly",
      quantity: 1,
    });

    expect(result.premium).toBe(true);
    const [row] = upsert.mock.calls[0];
    const days = (Date.parse(row.premium_expires_at) - Date.now()) / 86_400_000;
    // ~30 dias: folga para o tempo de execução do teste.
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it("concede a diária (day_pass) pela RPC, sem tocar em admin_trials", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "2026-11-01T00:00:00.000Z", error: null });
    const upsert = vi.fn();
    const supabase = {
      rpc,
      from: () => ({ upsert }),
    } as unknown as SupabaseClient;

    const result = await applyApprovedPayment(supabase, {
      id: "p-diaria",
      status: "approved",
      externalReference: "store-diaria",
      dateApproved: null,
      kind: "day_pass",
      quantity: 3,
    });

    // Não é Premium — a diária é acesso temporário, não assinatura.
    expect(result.premium).toBe(false);
    expect(result.handled).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("grant_day_pass");
    expect(args).toMatchObject({ p_store: "store-diaria", p_quantity: 3 });
  });
});
