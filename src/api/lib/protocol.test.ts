import { describe, expect, it } from "vitest";
import { generateProtocol, isValidProtocol, normalizeProtocol } from "@/api/lib/protocol";

describe("generateProtocol", () => {
  it("monta CID-AAAAMMDD-XXXXXX com o dia informado", () => {
    const p = generateProtocol(new Date("2026-11-04T12:00:00Z"), () => 0);
    expect(p).toBe("CID-20261104-222222");
  });

  it("não usa letras ambíguas no sufixo", () => {
    // Varre o gerador inteiro: nenhum caractere 0/O/1/I/L pode aparecer.
    for (let i = 0; i < 500; i++) {
      const suffix = generateProtocol(new Date("2026-01-01T00:00:00Z")).split("-")[2];
      expect(suffix).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
    }
  });

  it("é único entre chamadas", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateProtocol());
    expect(set.size).toBe(1000);
  });
});

describe("isValidProtocol", () => {
  it("aceita o formato canônico", () => {
    expect(isValidProtocol("CID-20261104-A3F9K2")).toBe(true);
  });

  it("aceita minúsculas e espaços", () => {
    expect(isValidProtocol("  cid-20261104-a3f9k2 ")).toBe(true);
  });

  it("rejeita formatos errados", () => {
    expect(isValidProtocol("CID-2026-A3F9K2")).toBe(false);
    expect(isValidProtocol("20261104-A3F9K2")).toBe(false);
    expect(isValidProtocol("CID-20261104-A3F9K")).toBe(false);
    expect(isValidProtocol("")).toBe(false);
  });
});

describe("normalizeProtocol", () => {
  it("padroniza para maiúsculas sem espaços", () => {
    expect(normalizeProtocol(" cid-20261104-a3f9k2 ")).toBe("CID-20261104-A3F9K2");
  });
});
