import { describe, expect, it } from "vitest";
import { realEmail } from "@/api/lib/support-reports";

describe("realEmail", () => {
  it("devolve um e-mail de verdade", () => {
    expect(realEmail("dono@loja.com")).toBe("dono@loja.com");
  });

  it("descarta o pseudo-e-mail interno do login por telefone", () => {
    expect(realEmail("48999880030@menufacil.local")).toBeUndefined();
  });

  it("devolve undefined para vazio/nulo", () => {
    expect(realEmail("")).toBeUndefined();
    expect(realEmail(null)).toBeUndefined();
    expect(realEmail(undefined)).toBeUndefined();
  });
});
