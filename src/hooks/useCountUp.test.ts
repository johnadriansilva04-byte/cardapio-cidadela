import { describe, expect, it } from "vitest";
import { formatNumeric, parseNumericValue } from "@/hooks/useCountUp";

describe("parseNumericValue", () => {
  it("separa prefixo, número e sufixo de valores em reais", () => {
    expect(parseNumericValue("R$ 1.234,56")).toEqual({ prefix: "R$ ", num: 1234.56, suffix: "" });
  });

  it("lê inteiros e sufixos textuais", () => {
    expect(parseNumericValue("12 pedidos")).toEqual({ prefix: "", num: 12, suffix: " pedidos" });
  });

  it("devolve null quando não há dígitos", () => {
    expect(parseNumericValue("Publicado")).toBeNull();
    expect(parseNumericValue("—")).toBeNull();
  });
});

describe("formatNumeric", () => {
  it("mostra decimais só quando existem", () => {
    expect(formatNumeric(42)).toBe("42");
    expect(formatNumeric(1234.5)).toBe("1.234,50");
    expect(formatNumeric(1234.567)).toBe("1.234,57");
  });
});
