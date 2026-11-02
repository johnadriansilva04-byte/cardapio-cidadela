import { describe, expect, it } from "vitest";
import { buildInvoiceEmail, getEmailFrom, getInvoiceNotifyEmail } from "./email";

const base = {
  id: "req-1",
  restaurantName: "Cantina da Praia",
  kind: "day_pass",
  quantity: 1,
  amountCents: 149,
  personType: "cpf",
  taxId: "11144477735",
  legalName: "Maria Souza",
  email: "maria@exemplo.com",
  address: null,
  notes: null,
  createdAt: "2026-10-31T12:00:00.000Z",
};

describe("buildInvoiceEmail", () => {
  it("leva o essencial para o fornecedor emitir a nota", () => {
    const { subject, html, text } = buildInvoiceEmail(base);
    expect(subject).toContain("Pedido de nota fiscal");
    expect(subject).toContain("Cantina da Praia");
    expect(html).toContain("maria@exemplo.com");
    expect(html).toContain("11144477735");
    expect(html).toContain("R$ 1,49");
    // O texto puro também precisa existir (cliente sem HTML).
    expect(text).toContain("Maria Souza");
    expect(text).toContain("ID do pedido: req-1");
  });

  it("mostra a quantidade quando é pacote de diárias", () => {
    const { html } = buildInvoiceEmail({ ...base, quantity: 3, amountCents: 447 });
    expect(html).toContain("(3×)");
    expect(html).toContain("R$ 4,47");
  });

  it("marca PJ e usa o rótulo CNPJ", () => {
    const { html } = buildInvoiceEmail({
      ...base,
      personType: "cnpj",
      taxId: "65025130000124",
      legalName: "Padaria LTDA",
    });
    expect(html).toContain("Pessoa jurídica (CNPJ)");
    expect(html).toContain("CNPJ");
  });

  it("não quebra com valor nulo (preço é preenchido pelo emissor)", () => {
    const { html } = buildInvoiceEmail({ ...base, amountCents: null });
    expect(html).toContain("—");
  });

  it("escapa HTML do que o dono digita (evita injeção no e-mail)", () => {
    const { html } = buildInvoiceEmail({
      ...base,
      legalName: '<img src=x onerror="alert(1)">',
      notes: "a < b & c",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
    expect(html).toContain("a &lt; b &amp; c");
  });
});

describe("destinos do e-mail", () => {
  it("usa o e-mail de suporte do COMPANY por padrão", () => {
    expect(getInvoiceNotifyEmail({})).toMatch(/@/);
  });

  it("respeita INVOICE_NOTIFY_EMAIL quando configurado", () => {
    expect(getInvoiceNotifyEmail({ INVOICE_NOTIFY_EMAIL: "notas@x.com" })).toBe("notas@x.com");
  });

  it("respeita EMAIL_FROM quando configurado", () => {
    expect(getEmailFrom({ EMAIL_FROM: "a@b.com" })).toBe("a@b.com");
  });
});
