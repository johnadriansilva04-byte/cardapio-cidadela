import { describe, expect, it } from "vitest";
import { classifyReport, buildReportSubject, buildInvoiceSubject } from "@/api/lib/report-subject";

describe("classifyReport", () => {
  it("cardápio público quebrado é urgente (trava o cliente)", () => {
    expect(classifyReport({ kind: "erro", route: "/cardapio/dona-da-pensao" })).toEqual({
      priority: "urgente",
      category: "Cardápio",
    });
  });

  it("checkout/pedido é urgente", () => {
    expect(classifyReport({ kind: "erro", route: "/pedido/abc" }).priority).toBe("urgente");
  });

  it("erro no painel é médio", () => {
    expect(classifyReport({ kind: "erro", route: "/admin/pedidos" })).toEqual({
      priority: "medio",
      category: "Painel",
    });
  });

  it("erro no mobile é gestão, médio", () => {
    expect(classifyReport({ kind: "erro", route: "/mobile/dashboard" }).category).toBe("Gestão");
  });

  it("conversa de suporte é suporte, médio", () => {
    expect(classifyReport({ kind: "suporte" })).toEqual({ priority: "medio", category: "Suporte" });
  });

  it("sem rota cai em sistema", () => {
    expect(classifyReport({ kind: "erro" }).category).toBe("Sistema");
  });
});

describe("buildReportSubject", () => {
  it("abre com a Pracinha, depois semáforo + categoria + loja", () => {
    expect(
      buildReportSubject({ priority: "urgente", category: "Cardápio", storeName: "Dona da Pensão" }),
    ).toBe("Pracinha · 🔴 Urgente · Cardápio — Dona da Pensão");
  });

  it("omite a loja quando não há", () => {
    expect(buildReportSubject({ priority: "leve", category: "Suporte" })).toBe(
      "Pracinha · 🟢 Leve · Suporte",
    );
  });
});

describe("buildInvoiceSubject", () => {
  it("identifica como nota fiscal, não como suporte", () => {
    expect(buildInvoiceSubject({ restaurantName: "Dona da Pensão", kindLabel: "Anual" })).toBe(
      "Pracinha · 🧾 Nota fiscal · Dona da Pensão · Anual",
    );
  });
});
