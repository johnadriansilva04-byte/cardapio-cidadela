import { describe, expect, it, beforeEach, vi } from "vitest";
import { AnalyticsClient } from "@/modules/analytics/client";
import { buildEnvelope, normalizePath, sanitizeProps } from "@/modules/analytics/events";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("sanitizeProps", () => {
  it("remove chaves com cara de dado pessoal", () => {
    const clean = sanitizeProps({
      phone: "11999999999",
      customer_email: "a@b.com",
      delivery_address: "Rua A",
      total: 35,
      itemCount: 2,
    });
    expect(clean).toEqual({ total: 35, itemCount: 2 });
  });

  it("descarta undefined e números não finitos", () => {
    expect(sanitizeProps({ a: undefined, b: NaN, c: Infinity, d: 1 })).toEqual({ d: 1 });
  });

  it("trunca strings longas", () => {
    const clean = sanitizeProps({ category: "x".repeat(500) });
    expect((clean.category as string).length).toBe(120);
  });
});

describe("normalizePath", () => {
  it("remove hash e query", () => {
    expect(normalizePath("/cardapio/loja?q=pizza#top")).toBe("/cardapio/loja");
  });

  it("cai para / em path vazio", () => {
    expect(normalizePath("")).toBe("/");
  });
});

describe("buildEnvelope", () => {
  it("serializa eventos e conta o lote", () => {
    const { payload, count } = buildEnvelope([
      { name: "page_view", props: {}, at: 1, anonId: "a", path: "/" },
    ]);
    expect(count).toBe(1);
    expect(JSON.parse(payload).events).toHaveLength(1);
  });
});

describe("AnalyticsClient", () => {
  it("não envia nada sem endpoint", async () => {
    const client = new AnalyticsClient();
    client.track("page_view", { path: "/" });
    expect(client.pending).toBe(0);
    expect(client.status()).toMatchObject({ enabled: false, hasEndpoint: false });
  });

  it("enfileira eventos conhecidos com endpoint configurado", () => {
    const client = new AnalyticsClient({ endpoint: "https://example.com/collect" });
    client.track("menu_opened", { slug: "loja" });
    client.track("order_created", { total: 35, customer_phone: "1199" });
    expect(client.pending).toBe(2);
  });

  it("ignora evento fora do catálogo", () => {
    const client = new AnalyticsClient({ endpoint: "https://example.com/collect" });
    // @ts-expect-error — garantindo o guard em runtime
    client.track("nao_existe", {});
    expect(client.pending).toBe(0);
  });

  it("envia o lote e esvazia a fila", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    // jsdom não implementa sendBeacon; forçamos o caminho do fetch.
    Object.defineProperty(navigator, "sendBeacon", { value: undefined, configurable: true });

    const client = new AnalyticsClient({ endpoint: "https://example.com/collect", flushAt: 1 });
    client.track("page_view", { path: "/" });
    await client.flush();

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(client.pending).toBe(0);
  });

  it("desligar o rastreamento limpa a fila e bloqueia novos eventos", () => {
    const client = new AnalyticsClient({ endpoint: "https://example.com/collect" });
    client.track("page_view", {});
    client.setEnabled(false);
    expect(client.pending).toBe(0);
    expect(client.status().optedOut).toBe(true);

    client.track("page_view", {});
    expect(client.pending).toBe(0);
  });

  it("reabilitar volta a permitir eventos", () => {
    const client = new AnalyticsClient({ endpoint: "https://example.com/collect" });
    client.setEnabled(false);
    client.setEnabled(true);
    client.track("page_view", {});
    expect(client.pending).toBe(1);
  });

  it("respeita Do Not Track", () => {
    Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });
    const client = new AnalyticsClient({ endpoint: "https://example.com/collect" });
    client.track("page_view", {});
    expect(client.pending).toBe(0);
    expect(client.status().doNotTrack).toBe(true);
    Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true });
  });
});
