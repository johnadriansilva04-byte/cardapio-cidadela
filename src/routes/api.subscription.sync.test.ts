import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Testa o handler HTTP REAL de `POST /api/subscription/sync`.
 *
 * O risco aqui é de segurança: a busca é pela LOJA, então sem validar a posse do
 * restaurante um token qualquer ativaria o Premium de outra loja informando o
 * `storeId` dela. O handler recebe `request` e devolve `Response`, então dá para
 * exercitá-lo como o navegador faria.
 */

type Handler = (ctx: { request: Request }) => Promise<Response>;

async function loadHandler(): Promise<Handler> {
  const mod = await import("./api.subscription.sync");
  const route = mod.Route as unknown as {
    options: { server: { handlers: { POST: Handler } } };
  };
  return route.options.server.handlers.POST;
}

function makeRequest(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("https://app.test/api/subscription/sync", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** Dubla o cliente Supabase do usuário (RLS aplicado com a identidade dele). */
function stubUserClient(opts: { owns?: boolean } = {}) {
  const from = () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({ data: opts.owns === false ? null : { id: "loja-x" }, error: null }),
      }),
    }),
  });
  return {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: { id: "user-1", email: "11999998888@menufacil.local" } },
          error: null,
        }),
    },
    from,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("POST /api/subscription/sync", () => {
  it("exige token de sessão (401 sem Authorization)", async () => {
    const handler = await loadHandler();
    const res = await handler({ request: makeRequest({ storeId: "loja-x" }) });
    expect(res.status).toBe(401);
  });

  it("recusa quando a loja não pertence à conta (403)", async () => {
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    const user = stubUserClient({ owns: false });
    vi.doMock("@/api/lib/mercadopago", async () => {
      const actual =
        await vi.importActual<typeof import("@/api/lib/mercadopago")>("@/api/lib/mercadopago");
      return { ...actual, getSupabaseForUser: () => user, getServerSupabase: () => ({}) };
    });

    const handler = await loadHandler();
    const res = await handler({ request: makeRequest({ storeId: "loja-de-outro" }, "tok") });

    expect(res.status).toBe(403);
  });

  it("busca os pagamentos da LOJA e ativa quando há um aprovado", async () => {
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "mp-token");

    const user = stubUserClient({ owns: true });
    const upserts: Record<string, unknown>[] = [];
    const server = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
        upsert: (payload: Record<string, unknown>) => {
          upserts.push(payload);
          return Promise.resolve({ error: null });
        },
      }),
    };
    vi.doMock("@/api/lib/mercadopago", async () => {
      const actual =
        await vi.importActual<typeof import("@/api/lib/mercadopago")>("@/api/lib/mercadopago");
      return { ...actual, getSupabaseForUser: () => user, getServerSupabase: () => server };
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: "pay-1",
              status: "approved",
              external_reference: "loja-x",
              payer: { phone: { area_code: "11", number: "999998888" } },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = await loadHandler();
    const res = await handler({ request: makeRequest({ storeId: "loja-x" }, "tok") });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "premium", preapprovalId: "pay-1" });
    // A busca é pela LOJA, não por e-mail — o pseudo-e-mail nunca apareceria no MP.
    expect(String(fetchMock.mock.calls[0][0])).toContain("external_reference=loja-x");
    expect(upserts[0]).toMatchObject({ store_id: "loja-x", is_premium: true });
  });
});
