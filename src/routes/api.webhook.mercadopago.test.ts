import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

/**
 * Testa o handler HTTP REAL do webhook (`POST /api/webhook/mercadopago`) — o
 * código de produção que o Mercado Pago chama, não uma cópia da regra.
 *
 * O handler recebe `request` e devolve `Response`, então dá para exercitá-lo
 * como o MP faria: montar a requisição, assinar (ou não) e checar status/corpo.
 * O I/O externo (Supabase e API do MP) é dublado na fronteira; a decisão de
 * segurança e o caminho de ativação são os reais.
 */

type Handler = (ctx: { request: Request }) => Promise<Response>;

async function loadHandler(): Promise<Handler> {
  const mod = await import("./api.webhook.mercadopago");
  const route = mod.Route as unknown as {
    options: { server: { handlers: { POST: Handler } } };
  };
  return route.options.server.handlers.POST;
}

const SECRET = "webhook-secret";

function sign(dataId: string, requestId: string, ts: string, secret = SECRET): string {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

function makeRequest(opts: {
  body: unknown;
  signature?: string;
  requestId?: string;
  authorization?: string;
}): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.signature) headers["x-signature"] = opts.signature;
  if (opts.requestId) headers["x-request-id"] = opts.requestId;
  if (opts.authorization) headers.authorization = opts.authorization;
  return new Request("https://app.test/api/webhook/mercadopago", {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body),
  });
}

/** Dubla o Supabase server-side usado pelo webhook. */
function stubServerSupabase(
  result: { error?: { message: string } | null; rows?: unknown[]; rpcData?: unknown } = {},
) {
  const upserts: { table: string; payload: Record<string, unknown>; opts?: unknown }[] = [];
  const rpcs: { name: string; args?: Record<string, unknown> }[] = [];
  const client = {
    from: (table: string) => ({
      upsert: (payload: Record<string, unknown>, opts?: unknown) => {
        upserts.push({ table, payload, opts });
        return {
          select: () =>
            Promise.resolve({ data: result.rows ?? [payload], error: result.error ?? null }),
        };
      },
    }),
    rpc: (name: string, args?: Record<string, unknown>) => {
      rpcs.push({ name, args });
      return Promise.resolve({ data: result.rpcData ?? null, error: null });
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user: { email: "dono@loja.com" } }, error: null }),
    },
  };
  return { client, upserts, rpcs };
}

/** Configura envs mínimas para o webhook processar um pagamento. */
function stubWebhookEnv() {
  vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "mp-token");
  vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
}

/** Faz o webhook usar o Supabase dublado. */
function mockServerSupabase(client: unknown) {
  return vi.doMock("@/api/lib/mercadopago", async () => {
    const actual =
      await vi.importActual<typeof import("@/api/lib/mercadopago")>("@/api/lib/mercadopago");
    return { ...actual, getServerSupabase: () => client };
  });
}

function paymentResponse(payment: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payment), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.unstubAllEnvs?.();
});

describe("POST /api/webhook/mercadopago — segurança", () => {
  it("recusa (503) quando o secret não está configurado — fail-closed", async () => {
    // Sem secret, qualquer um forjaria uma ativação. O endereço é público.
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "");
    vi.stubEnv("MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED", "");
    const handler = await loadHandler();

    const res = await handler({
      request: makeRequest({ body: { type: "payment", data: { id: "1" } } }),
    });

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/não configurado/) });
  });

  it("recusa (401) uma assinatura forjada quando há secret", async () => {
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", SECRET);
    const handler = await loadHandler();

    const res = await handler({
      request: makeRequest({
        body: { type: "payment", data: { id: "1" } },
        signature: sign("1", "req", "1700000000", "secret-errado"),
        requestId: "req",
      }),
    });

    expect(res.status).toBe(401);
  });

  it("aceita assinatura HMAC válida (Bearer <secret> também serve)", async () => {
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", SECRET);
    // O handler exige Supabase configurado para além da autenticação; aqui só
    // provamos que uma credencial válida passa pela barreira de assinatura.
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    const handler = await loadHandler();

    const res = await handler({
      request: makeRequest({
        body: { type: "unknown_type" },
        authorization: `Bearer ${SECRET}`,
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true });
  });
});

describe("POST /api/webhook/mercadopago — ativação", () => {
  it("ativa o Premium (1 ano) quando chega um pagamento aprovado", async () => {
    stubWebhookEnv();
    const fake = stubServerSupabase();
    await mockServerSupabase(fake.client);
    const fetchMock = vi.fn().mockResolvedValue(
      paymentResponse({
        id: "pay-1",
        status: "approved",
        external_reference: "loja-x",
        payer: { phone: { area_code: "11", number: "999998888" } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = await loadHandler();
    const res = await handler({
      request: makeRequest({
        body: { type: "payment", data: { id: "pay-1" } },
        authorization: `Bearer ${SECRET}`,
      }),
    });

    // O `/v1` é obrigatório: `/payments/{id}` responde 404 e o Premium nunca
    // ativava pelo link de pagamento.
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/payments/pay-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ activated: true, storeId: "loja-x" });
    expect(fake.upserts).toHaveLength(1);
    expect(fake.upserts[0]).toMatchObject({
      table: "admin_trials",
      opts: { onConflict: "store_id" },
    });
    expect(fake.upserts[0].payload).toMatchObject({
      store_id: "loja-x",
      is_premium: true,
      admin_phone: "11999998888",
    });
    // Expiração ~1 ano à frente.
    const expires = Date.parse(String(fake.upserts[0].payload.premium_expires_at));
    expect(expires).toBeGreaterThan(Date.now() + 300 * 24 * 60 * 60 * 1000);
  });

  it("cai para o TELEFONE do pagador quando o pagamento não traz external_reference", async () => {
    stubWebhookEnv();
    const fake = stubServerSupabase({ rpcData: "loja-do-telefone" });
    await mockServerSupabase(fake.client);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        paymentResponse({
          id: "pay-4",
          status: "approved",
          payer: { phone: { area_code: "11", number: "988887777" } },
        }),
      ),
    );

    const handler = await loadHandler();
    const res = await handler({
      request: makeRequest({
        body: { type: "payment", data: { id: "pay-4" } },
        authorization: `Bearer ${SECRET}`,
      }),
    });

    expect(fake.rpcs).toEqual([{ name: "find_store_by_phone", args: { p_phone: "11988887777" } }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ activated: true, storeId: "loja-do-telefone" });
  });

  it("resolve o merchant_order para o pagamento dele (não busca o id como pagamento)", async () => {
    stubWebhookEnv();
    const fake = stubServerSupabase();
    await mockServerSupabase(fake.client);
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("/merchant_orders/")) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: "mo-7", payments: [{ id: "pay-77" }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(
        paymentResponse({
          id: "pay-77",
          status: "approved",
          external_reference: "loja-x",
          payer: { phone: { area_code: "11", number: "999998888" } },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const handler = await loadHandler();
    const res = await handler({
      request: makeRequest({
        body: { type: "merchant_order", data: { id: "mo-7" } },
        authorization: `Bearer ${SECRET}`,
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ activated: true, storeId: "loja-x" });
    // Busca o pedido e depois o pagamento dele — nunca `/payments/mo-7`.
    expect(String(fetchMock.mock.calls[0][0])).toContain("/merchant_orders/mo-7");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/v1/payments/pay-77");
    expect(fake.upserts[0].payload).toMatchObject({ store_id: "loja-x", is_premium: true });
  });

  it("descarta um external_reference que seja e-mail (nunca vira store_id)", async () => {
    stubWebhookEnv();
    const fake = stubServerSupabase();
    await mockServerSupabase(fake.client);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        paymentResponse({
          id: "pay-5",
          status: "approved",
          external_reference: "11999998888@menufacil.local",
        }),
      ),
    );

    const handler = await loadHandler();
    const res = await handler({
      request: makeRequest({
        body: { type: "payment", data: { id: "pay-5" } },
        authorization: `Bearer ${SECRET}`,
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ error: "invalid reference" });
    expect(fake.upserts).toHaveLength(0);
  });

  it("devolve 500 (para o MP reentregar) quando a ativação não persiste", async () => {
    stubWebhookEnv();
    // upsert sem linhas: antes o webhook devolvia 200 e o pagamento se perdia.
    const fake = stubServerSupabase({ rows: [] });
    await mockServerSupabase(fake.client);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          paymentResponse({ id: "pay-2", status: "approved", external_reference: "loja-x" }),
        ),
    );

    const handler = await loadHandler();
    const res = await handler({
      request: makeRequest({
        body: { type: "payment", data: { id: "pay-2" } },
        authorization: `Bearer ${SECRET}`,
      }),
    });

    expect(res.status).toBe(500);
  });

  it("ignora pagamento não aprovado (não liga o Premium)", async () => {
    stubWebhookEnv();
    const fake = stubServerSupabase();
    await mockServerSupabase(fake.client);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          paymentResponse({ id: "pay-3", status: "pending", external_reference: "loja-x" }),
        ),
    );

    const handler = await loadHandler();
    const res = await handler({
      request: makeRequest({
        body: { type: "payment", data: { id: "pay-3" } },
        authorization: `Bearer ${SECRET}`,
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "pending" });
    expect(fake.upserts).toHaveLength(0);
  });
});
