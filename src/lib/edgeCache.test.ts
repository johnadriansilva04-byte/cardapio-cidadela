import { describe, it, expect } from "vitest";
import { edgeCacheControlFor, EDGE_CACHE_RULES } from "./edgeCache";

describe("cache de borda (Cloudflare)", () => {
  it("cacheia o HTML do cardápio público", () => {
    expect(edgeCacheControlFor("/cardapio/abc", "text/html; charset=utf-8", false)).toBe(
      "public, s-maxage=60, stale-while-revalidate=300",
    );
  });

  it("cacheia a landing", () => {
    expect(edgeCacheControlFor("/", "text/html", false)).toContain("s-maxage=300");
  });

  it("NÃO cacheia o painel autenticado nem o mobile", () => {
    for (const p of [
      "/admin",
      "/admin/pedidos",
      "/mobile",
      "/mobile/config",
      "/pedido/123",
      "/login",
      "/meus-pedidos",
    ]) {
      expect(edgeCacheControlFor(p, "text/html", false)).toBeNull();
    }
  });

  it("NÃO cacheia respostas de API nem assets", () => {
    expect(edgeCacheControlFor("/api/webhook/mercadopago", "application/json", false)).toBeNull();
    expect(edgeCacheControlFor("/cardapio/abc", "application/json", false)).toBeNull();
  });

  it("respeita um cache-control já definido pela resposta", () => {
    expect(edgeCacheControlFor("/cardapio/abc", "text/html", true)).toBeNull();
  });

  it("nunca cacheia HTML que emite cookie (sessão)", () => {
    expect(edgeCacheControlFor("/cardapio/abc", "text/html", false, true)).toBeNull();
    expect(edgeCacheControlFor("/", "text/html", false, true)).toBeNull();
  });

  it("cada regra cobre exatamente o seu caminho", () => {
    expect(EDGE_CACHE_RULES.some((r) => r.test("/cardapio/loja-1"))).toBe(true);
    expect(EDGE_CACHE_RULES.some((r) => r.test("/cardapio"))).toBe(false);
  });
});
