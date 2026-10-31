import { describe, expect, it } from "vitest";
import {
  COMPANY,
  COMPANY_LEGAL_LINE,
  hasFiscalData,
  hasSupportContact,
  missingFiscalFields,
} from "./company";

/** Valida um CNPJ pelo algoritmo oficial (módulo 11). */
function isValidCnpj(digits: string): boolean {
  if (!/^\d{14}$/.test(digits)) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calc = (base: string): number => {
    let weight = base.length - 7;
    let sum = 0;
    for (const char of base) {
      sum += Number(char) * weight--;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const check1 = calc(digits.slice(0, 12));
  const check2 = calc(digits.slice(0, 12) + check1);
  return digits === digits.slice(0, 12) + String(check1) + String(check2);
}

describe("COMPANY (dados legais do fornecedor)", () => {
  it("tem um CNPJ com 14 dígitos e dígito verificador válido", () => {
    expect(COMPANY.cnpjDigits).toMatch(/^\d{14}$/);
    expect(isValidCnpj(COMPANY.cnpjDigits)).toBe(true);
  });

  it("formata o CNPJ exatamente como os dígitos canônicos", () => {
    const onlyDigits = COMPANY.cnpj.replace(/\D/g, "");
    expect(onlyDigits).toBe(COMPANY.cnpjDigits);
    expect(COMPANY.cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
  });

  it("tem razão social e marca não vazias", () => {
    expect(COMPANY.legalName.trim().length).toBeGreaterThan(0);
    expect(COMPANY.brandName.trim().length).toBeGreaterThan(0);
  });

  it("monta a linha legal com razão social e CNPJ", () => {
    expect(COMPANY_LEGAL_LINE).toContain(COMPANY.legalName);
    expect(COMPANY_LEGAL_LINE).toContain(COMPANY.cnpj);
  });

  it("hasSupportContact reflete a presença de e-mail ou telefone", () => {
    expect(hasSupportContact).toBe(Boolean(COMPANY.supportEmail || COMPANY.supportPhone));
  });

  it("quando há telefone de suporte, ele é só dígitos com DDI", () => {
    if (COMPANY.supportPhone) {
      expect(COMPANY.supportPhone).toMatch(/^\d{12,13}$/);
    }
  });

  it("lista os campos fiscais pendentes enquanto não há dados completos", () => {
    // Sem dados fiscais preenchidos, a lista tem os obrigatórios (menos o
    // complemento, que é opcional). É o que a UI usa para dizer o que falta.
    expect(missingFiscalFields).not.toContain("complemento");
    expect(hasFiscalData).toBe(missingFiscalFields.length === 0);
    if (!hasFiscalData) {
      expect(missingFiscalFields.length).toBeGreaterThan(0);
    }
  });

  it("o CEP, quando preenchido, é só dígitos", () => {
    if (COMPANY.fiscal.zip) expect(COMPANY.fiscal.zip).toMatch(/^\d{8}$/);
  });
});
