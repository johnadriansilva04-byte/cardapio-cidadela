import { describe, expect, it } from "vitest";
import {
  formatTaxId,
  isValidCnpj,
  isValidCpf,
  isValidTaxId,
  normalizeTaxId,
  validateInvoiceRequest,
} from "./invoice";

describe("isValidCpf", () => {
  it("aceita CPF válido, com e sem máscara", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("recusa tamanho errado e vazio", () => {
    expect(isValidCpf("")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("529982247251")).toBe(false);
  });
});

describe("isValidCnpj", () => {
  it("aceita CNPJ válido, com e sem máscara", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });

  it("valida o próprio CNPJ da empresa", () => {
    expect(isValidCnpj("65.025.130/0001-24")).toBe(true);
  });
});

describe("isValidTaxId", () => {
  it("respeita o tipo escolhido", () => {
    // Um CPF válido não passa como CNPJ e vice-versa.
    expect(isValidTaxId("52998224725", "cpf")).toBe(true);
    expect(isValidTaxId("52998224725", "cnpj")).toBe(false);
    expect(isValidTaxId("11222333000181", "cnpj")).toBe(true);
    expect(isValidTaxId("11222333000181", "cpf")).toBe(false);
  });
});

describe("normalizeTaxId / formatTaxId", () => {
  it("tira a máscara", () => {
    expect(normalizeTaxId("529.982.247-25")).toBe("52998224725");
  });

  it("formata CPF e CNPJ progressivamente", () => {
    expect(formatTaxId("52998224725", "cpf")).toBe("529.982.247-25");
    expect(formatTaxId("11222333000181", "cnpj")).toBe("11.222.333/0001-81");
    expect(formatTaxId("529", "cpf")).toBe("529");
  });

  it("não deixa passar do tamanho do documento", () => {
    expect(normalizeTaxId(formatTaxId("529982247259999", "cpf"))).toHaveLength(11);
    expect(normalizeTaxId(formatTaxId("112223330001819999", "cnpj"))).toHaveLength(14);
  });
});

describe("validateInvoiceRequest", () => {
  const base = {
    personType: "cnpj" as const,
    taxId: "11.222.333/0001-81",
    legalName: "Restaurante Teste LTDA",
    email: "financeiro@teste.com.br",
  };

  it("aceita um pedido completo", () => {
    expect(validateInvoiceRequest(base)).toBeNull();
  });

  it("exige nome com pelo menos 3 caracteres", () => {
    expect(validateInvoiceRequest({ ...base, legalName: "ab" })).toMatch(/razão social|nome/i);
  });

  it("recusa documento inválido", () => {
    expect(validateInvoiceRequest({ ...base, taxId: "11.222.333/0001-99" })).toBe("CNPJ inválido.");
    expect(
      validateInvoiceRequest({ ...base, personType: "cpf", taxId: "529.982.247-24" }),
    ).toBe("CPF inválido.");
  });

  it("recusa e-mail inválido", () => {
    expect(validateInvoiceRequest({ ...base, email: "sem-arroba" })).toMatch(/e-mail/i);
    expect(validateInvoiceRequest({ ...base, email: "a@b" })).toMatch(/e-mail/i);
  });

  it("recusa campos longos demais", () => {
    expect(validateInvoiceRequest({ ...base, notes: "x".repeat(501) })).toMatch(/longa/i);
    expect(validateInvoiceRequest({ ...base, address: "x".repeat(301) })).toMatch(/longo/i);
  });
});
