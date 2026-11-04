import { describe, expect, it } from "vitest";
import { buildDevReport } from "@/api/lib/dev-report";

describe("buildDevReport — erro", () => {
  it("inclui a mensagem, o stack e o prompt para o dev", () => {
    const r = buildDevReport({
      kind: "erro",
      ownerEmail: "dono@loja.com",
      storeName: "Cantina",
      error: {
        message: "Cannot read properties of undefined (reading 'total')",
        stack: "TypeError: ...\n  at OrderCard (OrderCard.tsx:42)",
        route: "/admin/pedidos",
        component: "ErrorBoundary",
      },
    });
    expect(r.subject).toContain("[Pracinha]");
    expect(r.subject).toContain("Erro no app");
    expect(r.text).toContain("Olá, CEO!");
    expect(r.text).toContain("Cannot read properties of undefined");
    expect(r.text).toContain("OrderCard.tsx:42");
    expect(r.text).toContain("PARA O DEV");
    expect(r.text).toContain("cardapio-cidadela");
    // O contexto de quem reclamou tem que estar no e-mail.
    expect(r.text).toContain("dono@loja.com");
    expect(r.text).toContain("Cantina");
  });

  it("não quebra sem stack", () => {
    const r = buildDevReport({ kind: "erro", error: { message: "boom" } });
    expect(r.text).toContain("boom");
    expect(r.text).toContain("(sem stack)");
  });
});

describe("buildDevReport — suporte", () => {
  it("inclui a conversa e o prompt de suporte", () => {
    const r = buildDevReport({
      kind: "suporte",
      storeName: "Pizzaria X",
      turns: [
        { role: "user", content: "o preço está errado no pedido" },
        { role: "assistant", content: "Vou passar para a engenharia." },
      ],
    });
    expect(r.subject).toContain("[Pracinha]");
    expect(r.subject).toContain("Relato de cliente");
    expect(r.text).toContain("Olá, CEO!");
    expect(r.text).toContain("o preço está errado no pedido");
    expect(r.text).toContain("PARA O DEV");
    expect(r.text).toContain("causa raiz");
  });

  it("escapa HTML da conversa (sem injeção no e-mail)", () => {
    const r = buildDevReport({
      kind: "suporte",
      turns: [{ role: "user", content: "<script>alert(1)</script>" }],
    });
    expect(r.html).not.toContain("<script>alert(1)</script>");
    expect(r.html).toContain("&lt;script&gt;");
  });
});
