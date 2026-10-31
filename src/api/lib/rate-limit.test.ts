import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit, getClientIp, resetRateLimit } from "./rate-limit";

afterEach(() => resetRateLimit());

describe("checkRateLimit", () => {
  it("libera até o limite e bloqueia a partir daí", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("k", 3, 60_000, t).ok).toBe(true);
    }
    const blocked = checkRateLimit("k", 3, 60_000, t);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("chaves diferentes não interferem", () => {
    const t = 1_000_000;
    checkRateLimit("a", 1, 60_000, t);
    expect(checkRateLimit("a", 1, 60_000, t).ok).toBe(false);
    expect(checkRateLimit("b", 1, 60_000, t).ok).toBe(true);
  });

  it("libera de novo depois da janela", () => {
    const t = 1_000_000;
    checkRateLimit("k", 1, 1_000, t);
    expect(checkRateLimit("k", 1, 1_000, t).ok).toBe(false);
    expect(checkRateLimit("k", 1, 1_000, t + 1_001).ok).toBe(true);
  });
});

describe("getClientIp", () => {
  it("usa o primeiro IP do x-forwarded-for", () => {
    const req = new Request("https://x.test", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18" },
    });
    expect(getClientIp(req)).toBe("203.0.113.7");
  });

  it("cai para x-real-ip e depois unknown", () => {
    expect(
      getClientIp(new Request("https://x.test", { headers: { "x-real-ip": "1.2.3.4" } })),
    ).toBe("1.2.3.4");
    expect(getClientIp(new Request("https://x.test"))).toBe("unknown");
  });
});
