import { describe, expect, it } from "vitest";
import {
  PREMIUM_PRICE_LABEL,
  PREMIUM_PRICE_VALUE,
  formatPremiumPriceLabel,
  parsePriceValue,
} from "@/lib/pricing";

describe("parsePriceValue", () => {
  it("aceita inteiro, decimal com ponto e com vírgula", () => {
    expect(parsePriceValue("1")).toBe(1);
    expect(parsePriceValue("1.00")).toBe(1);
    expect(parsePriceValue("1,00")).toBe(1);
    expect(parsePriceValue("199.99")).toBe(199.99);
  });

  it("ignora vazio, inválido e não-positivo", () => {
    expect(parsePriceValue("")).toBeUndefined();
    expect(parsePriceValue(undefined)).toBeUndefined();
    expect(parsePriceValue("abc")).toBeUndefined();
    expect(parsePriceValue("0")).toBeUndefined();
    expect(parsePriceValue("-5")).toBeUndefined();
  });
});

describe("formatPremiumPriceLabel", () => {
  it("formata em pt-BR", () => {
    expect(formatPremiumPriceLabel(1)).toBe("R$ 1,00/ano");
    expect(formatPremiumPriceLabel(199.99)).toBe("R$ 199,99/ano");
  });
});

describe("defaults de produção", () => {
  it("sem env, mantém o preço e o rótulo padrão", () => {
    expect(PREMIUM_PRICE_VALUE).toBe(199.99);
    expect(PREMIUM_PRICE_LABEL).toBe("R$ 199,99/ano");
  });
});
