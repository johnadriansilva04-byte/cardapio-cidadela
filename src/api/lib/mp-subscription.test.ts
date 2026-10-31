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
});
