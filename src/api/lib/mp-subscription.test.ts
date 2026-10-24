import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyPreapproval,
  processPreapprovalById,
  syncSubscriptionForStore,
} from "./mp-subscription";
import type { PreapprovalInfo } from "./mercadopago";

/**
 * Testes da ativação do Premium a partir de um pagamento do Mercado Pago.
 *
 * É o trecho mais crítico do fluxo do dinheiro: se falhar em silêncio, o
 * cliente paga e o Premium não liga (ou liga para o restaurante errado).
 *
 * A correlação é por LOJA (`external_reference`) e, como fallback, por TELEFONE
 * do pagador — nunca por e-mail. O app autentica por telefone e o e-mail da
 * conta é um pseudo-endereço interno (`<ddd><numero>@menufacil.local`) que o
 * Mercado Pago não conhece.
 *
 * O `mp-subscription` recebe o cliente Supabase por parâmetro, então exercitamos
 * a lógica REAL com um dublê só na fronteira de I/O (Supabase/fetch) — a
 * decisão de ativar/cancelar/ignorar é o código de produção.
 */

interface Recorded {
  upserts: { table: string; payload: Record<string, unknown>; opts?: unknown }[];
  updates: { table: string; payload: Record<string, unknown>; eq?: [string, unknown] }[];
  rpcs: { name: string; args?: Record<string, unknown> }[];
}

function makeFakeSupabase() {
  const calls: Recorded = { upserts: [], updates: [], rpcs: [] };
  let rpcResult: { data: unknown; error: unknown } = { data: null, error: null };
  let row: Record<string, unknown> | null = null;
  let writeError: { message: string } | null = null;

  const from = (table: string) => ({
    upsert: (payload: Record<string, unknown>, opts?: unknown) => {
      calls.upserts.push({ table, payload, opts });
      return Promise.resolve({ error: writeError });
    },
    update: (payload: Record<string, unknown>) => {
      const record = { table, payload } as Recorded["updates"][number];
      calls.updates.push(record);
      return {
        eq: (col: string, val: unknown) => {
          record.eq = [col, val];
          return Promise.resolve({ error: writeError });
        },
      };
    },
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: row, error: null }),
      }),
    }),
  });

  const client = {
    from,
    rpc: (name: string, args?: Record<string, unknown>) => {
      calls.rpcs.push({ name, args });
      return Promise.resolve(rpcResult);
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    calls,
    setRpcResult: (r: { data: unknown; error: unknown }) => {
      rpcResult = r;
    },
    setRow: (r: Record<string, unknown> | null) => {
      row = r;
    },
    setWriteError: (e: { message: string } | null) => {
      writeError = e;
    },
  };
}

function info(overrides: Partial<PreapprovalInfo> = {}): PreapprovalInfo {
  return {
    id: "preapproval-1",
    status: "authorized",
    payerPhone: "11999998888",
    externalReference: "minha-loja",
    nextPaymentDate: "2027-01-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("applyPreapproval", () => {
  it("liga o Premium (upsert) quando o preapproval está ativo", async () => {
    const fake = makeFakeSupabase();
    const result = await applyPreapproval(fake.client, info());

    expect(result).toMatchObject({ handled: true, storeId: "minha-loja", premium: true });
    expect(fake.calls.upserts).toHaveLength(1);
    const { table, payload, opts } = fake.calls.upserts[0];
    expect(table).toBe("admin_trials");
    expect(payload).toMatchObject({
      store_id: "minha-loja",
      is_premium: true,
      mercadopago_preapproval_id: "preapproval-1",
      admin_phone: "11999998888",
    });
    expect(payload.premium_expires_at).toBe("2027-01-01T00:00:00.000Z");
    // Sem onConflict por store_id, um restaurante já existente ganharia uma
    // segunda linha e a leitura pegaria a errada.
    expect(opts).toEqual({ onConflict: "store_id" });
  });

  it("resolve o restaurante pelo TELEFONE do pagador quando falta external_reference", async () => {
    const fake = makeFakeSupabase();
    fake.setRpcResult({ data: "loja-do-telefone", error: null });

    const result = await applyPreapproval(
      fake.client,
      info({ externalReference: "", payerPhone: "11999998888" }),
    );

    expect(fake.calls.rpcs).toEqual([
      { name: "find_store_by_phone", args: { p_phone: "11999998888" } },
    ]);
    expect(result.storeId).toBe("loja-do-telefone");
    expect(fake.calls.upserts[0].payload).toMatchObject({ store_id: "loja-do-telefone" });
  });

  it("nunca usa um e-mail como store_id (external_reference inválido)", async () => {
    const fake = makeFakeSupabase();
    // Regressão: o pseudo-e-mail da conta era gravado como referência e o
    // webhook o usaria como store_id, criando uma linha órfã em admin_trials.
    const result = await applyPreapproval(
      fake.client,
      info({ externalReference: "11999998888@menufacil.local" }),
    );

    expect(result.handled).toBe(false);
    expect(fake.calls.upserts).toHaveLength(0);
  });

  it("desliga o Premium quando o preapproval é cancelado", async () => {
    const fake = makeFakeSupabase();
    const result = await applyPreapproval(fake.client, info({ status: "cancelled" }));

    expect(result).toMatchObject({ handled: true, premium: false });
    expect(fake.calls.upserts).toHaveLength(0);
    expect(fake.calls.updates[0]).toMatchObject({
      table: "admin_trials",
      payload: { is_premium: false, premium_expires_at: null },
      eq: ["store_id", "minha-loja"],
    });
  });

  it("ignora status nem ativo nem cancelado, sem escrever", async () => {
    const fake = makeFakeSupabase();
    const result = await applyPreapproval(fake.client, info({ status: "pending" }));

    expect(result).toMatchObject({ handled: true, premium: false });
    expect(fake.calls.upserts).toHaveLength(0);
    expect(fake.calls.updates).toHaveLength(0);
  });

  it("não ativa nada quando não dá para resolver o restaurante", async () => {
    const fake = makeFakeSupabase();
    fake.setRpcResult({ data: null, error: null });

    const result = await applyPreapproval(
      fake.client,
      info({ externalReference: "", payerPhone: "11000000000" }),
    );

    expect(result.handled).toBe(false);
    expect(fake.calls.upserts).toHaveLength(0);
  });

  it("propaga a falha do upsert em vez de fingir sucesso", async () => {
    // O bug que isto trava: um upsert silencioso deixava o webhook devolver 200
    // e o pagamento ficava "perdido" — Premium nunca ligava.
    const fake = makeFakeSupabase();
    fake.setWriteError({ message: "rls" });

    const result = await applyPreapproval(fake.client, info());

    expect(result.handled).toBe(false);
    expect(result.reason).toBe("rls");
  });
});

describe("processPreapprovalById", () => {
  it("busca no MP e aplica o preapproval recebido", async () => {
    const fake = makeFakeSupabase();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "pp-42",
          status: "authorized",
          payer_phone: { area_code: "11", number: "999998888" },
          external_reference: "loja-x",
          next_payment_date: "2027-02-02T00:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await processPreapprovalById(fake.client, "pp-42", {
      MERCADOPAGO_ACCESS_TOKEN: "token",
    });

    expect(result).toMatchObject({ handled: true, premium: true, storeId: "loja-x" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/preapproval/pp-42");
    expect(fake.calls.upserts[0].payload).toMatchObject({ store_id: "loja-x", is_premium: true });
  });

  it("degrada com segurança quando o MP recusa a consulta", async () => {
    const fake = makeFakeSupabase();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));

    const result = await processPreapprovalById(fake.client, "inexistente", {
      MERCADOPAGO_ACCESS_TOKEN: "token",
    });

    expect(result.handled).toBe(false);
    expect(result.reason).toBe("MP HTTP 404");
    expect(fake.calls.upserts).toHaveLength(0);
  });
});

describe("syncSubscriptionForStore", () => {
  it("ativa quando há um pagamento aprovado da loja", async () => {
    const fake = makeFakeSupabase();
    fake.setRow({ store_id: "loja-x", admin_phone: null });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: "pay-9",
              status: "approved",
              external_reference: "loja-x",
              payer: { phone: { area_code: "11", number: "988887777" } },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncSubscriptionForStore(fake.client, "loja-x", {
      MERCADOPAGO_ACCESS_TOKEN: "token",
    });

    expect(result).toMatchObject({ status: "premium", preapprovalId: "pay-9" });
    // A busca é pela LOJA (external_reference), não por e-mail. O `/v1` é
    // obrigatório: sem ele a API responde 404 e a busca volta sempre vazia.
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/payments/search");
    expect(String(fetchMock.mock.calls[0][0])).toContain("external_reference=loja-x");
    expect(fake.calls.upserts[0].payload).toMatchObject({
      store_id: "loja-x",
      is_premium: true,
      admin_phone: "11988887777",
    });
  });

  it("devolve 'none' quando a loja não tem pagamento no MP", async () => {
    const fake = makeFakeSupabase();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const result = await syncSubscriptionForStore(fake.client, "loja-x", {
      MERCADOPAGO_ACCESS_TOKEN: "token",
    });

    expect(result).toMatchObject({ status: "none", preapprovalId: null });
    expect(fake.calls.upserts).toHaveLength(0);
  });

  it("devolve 'free' quando há pagamento mas nenhum aprovado", async () => {
    const fake = makeFakeSupabase();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [{ id: "pay-1", status: "pending", external_reference: "loja-x" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await syncSubscriptionForStore(fake.client, "loja-x", {
      MERCADOPAGO_ACCESS_TOKEN: "token",
    });

    expect(result).toMatchObject({ status: "free", preapprovalId: "pay-1" });
    expect(fake.calls.upserts).toHaveLength(0);
  });
});
