import { describe, expect, it } from "vitest";
import {
  MONTHLY_PRICE_LABEL,
  MONTHLY_PRICE_VALUE,
  PREMIUM_PRICE_LABEL,
  PREMIUM_PRICE_VALUE,
  formatMonthlyEquivalent,
  formatMonthlyPriceLabel,
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

describe("formatMonthlyEquivalent", () => {
  it("divide o anual por 12, em pt-BR", () => {
    expect(formatMonthlyEquivalent(199.99)).toBe("R$ 16,67");
    expect(formatMonthlyEquivalent(12)).toBe("R$ 1,00");
  });
});

describe("formatMonthlyPriceLabel", () => {
  it("formata em pt-BR com sufixo /mês", () => {
    expect(formatMonthlyPriceLabel(28.99)).toBe("R$ 28,99/mês");
    expect(formatMonthlyPriceLabel(1)).toBe("R$ 1,00/mês");
  });
});

describe("defaults de produção", () => {
  it("sem env, mantém os preços e rótulos padrão", () => {
    expect(PREMIUM_PRICE_VALUE).toBe(199.99);
    expect(PREMIUM_PRICE_LABEL).toBe("R$ 199,99/ano");
    expect(MONTHLY_PRICE_VALUE).toBe(28.99);
    expect(MONTHLY_PRICE_LABEL).toBe("R$ 28,99/mês");
  });
});
