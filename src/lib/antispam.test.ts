import { describe, expect, it } from "vitest";
import { looksLikeBot, MIN_CHECKOUT_MS } from "./antispam";

describe("looksLikeBot", () => {
  it("libera um humano que demorou para preencher", () => {
    expect(looksLikeBot({ honeypot: "", openedAt: 0, now: MIN_CHECKOUT_MS + 1 })).toBe(false);
  });

  it("barra quando o honeypot foi preenchido", () => {
    expect(looksLikeBot({ honeypot: "acme", openedAt: 0, now: 999_999 })).toBe(true);
  });

  it("barra envio rápido demais", () => {
    expect(looksLikeBot({ honeypot: "", openedAt: 1000, now: 1000 + MIN_CHECKOUT_MS - 1 })).toBe(
      true,
    );
  });
});
