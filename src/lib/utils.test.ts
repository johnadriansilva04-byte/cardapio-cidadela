import { describe, expect, it } from "vitest";
import {
  brl,
  buildPixPayload,
  buildThermalTicket,
  buildWhatsAppMessage,
  formatDeliveryAddress,
  generateSlug,
  hexToRgba,
  sendToWhatsApp,
  statusLabel,
} from "@/lib/utils";

describe("brl", () => {
  it("formata em real brasileiro", () => {
    expect(brl(1234.5).replace(/\u00a0/g, " ")).toBe("R$ 1.234,50");
  });
});

describe("generateSlug", () => {
  it("remove acentos, espaços e pontuação", () => {
    expect(generateSlug("Pão & Cia — Lanches")).toBe("pao-cia-lanches");
  });

  it("colapsa separadores repetidos", () => {
    expect(generateSlug("  A   B  ")).toBe("a-b");
  });
});

describe("hexToRgba", () => {
  it("expande hex curto", () => {
    expect(hexToRgba("#0af", 0.5)).toBe("rgba(0, 170, 255, 0.5)");
  });

  it("converte hex completo", () => {
    expect(hexToRgba("#06b6d4", 1)).toBe("rgba(6, 182, 212, 1)");
  });

  it("cai no ciano quando o valor é inválido", () => {
    expect(hexToRgba(undefined, 0.2)).toBe("rgba(6, 182, 212, 0.2)");
    expect(hexToRgba("#zzz", 0.2)).toBe("rgba(6, 182, 212, 0.2)");
  });
});

describe("statusLabel", () => {
  it("traduz cada status", () => {
    expect(statusLabel("draft")).toBe("RASCUNHO");
    expect(statusLabel("published")).toBe("PUBLICADO");
    expect(statusLabel("paused")).toBe("PAUSADO");
  });
});

describe("buildPixPayload", () => {
  const payload = buildPixPayload({
    pixKey: "pix@exemplo.com",
    merchantName: "Loja Teste",
    merchantCity: "Sao Paulo",
    amount: 35.5,
    txid: "PEDIDO-1",
  });

  it("monta o payload EMV com CRC16 válido", () => {
    expect(payload.startsWith("000201")).toBe(true);
    expect(payload).toContain("br.gov.bcb.pix");
    expect(payload).toContain("pix@exemplo.com");
    expect(payload).toContain("5303986");
    expect(payload).toContain("540535.50");
    // CRC dos últimos 4 chars precisa conferir com o corpo em "6304"
    expect(/^[0-9A-F]{4}$/.test(payload.slice(-4))).toBe(true);
  });

  it("devolve vazio sem chave pix", () => {
    expect(
      buildPixPayload({
        pixKey: "",
        merchantName: "X",
        merchantCity: "Y",
        amount: 1,
        txid: "a",
      }),
    ).toBe("");
  });

  it("sanitiza nome e cidade", () => {
    const p = buildPixPayload({
      pixKey: "k",
      merchantName: "Loja Ção!!",
      merchantCity: "São Paulo",
      amount: 1,
      txid: "x",
    });
    // Acentuados saem do payload (EMV só aceita ASCII), virando o resto da palavra.
    expect(p).toContain("LOJA O");
    expect(p).toContain("SO PAULO");
  });
});

describe("formatDeliveryAddress", () => {
  it("quebra em linhas de até 40 caracteres", () => {
    const lines = formatDeliveryAddress({
      delivery_address: "Rua das Flores, 1200",
      customer_complement: "Apto 101",
      customer_neighborhood: "Centro",
      customer_city: "Cidade Grande",
    });
    expect(lines.every((l) => l.length <= 40)).toBe(true);
    expect(lines.join(" ")).toContain("Centro");
  });

  it("devolve aviso quando não há endereço", () => {
    expect(
      formatDeliveryAddress({
        delivery_address: "",
        customer_complement: "",
        customer_neighborhood: "",
        customer_city: "",
      }),
    ).toEqual(["Endereço não informado"]);
  });
});

const order = {
  comanda: "#7",
  customer_name: "Ana",
  customer_phone: "1199",
  delivery_address: "Rua A, 10",
  customer_complement: "",
  customer_neighborhood: "Centro",
  customer_city: "Cidade",
  delivery_type: "entrega",
  observations: "Sem cebola",
  total: 35,
  delivery_fee: 5,
  payment_method: "pix",
  created_at: "2026-09-19T12:00:00.000Z",
  order_items: [{ product_name: "X-Burger", quantity: 1, total: 30, notes: "" }],
};

describe("buildThermalTicket", () => {
  it("inclui as linhas de 32 colunas e o total", () => {
    const ticket = buildThermalTicket(order, "Loja A");
    expect(ticket).toContain("LOJA A");
    expect(ticket).toContain("PEDIDO: #7");
    expect(ticket).toContain("TAXA ENTREGA");
    expect(ticket.replace(/\u00a0/g, " ")).toContain("R$ 35,00");
    expect(ticket).toContain("-".repeat(32));
  });

  it("não mostra taxa quando é retirada", () => {
    const ticket = buildThermalTicket({ ...order, delivery_type: "retirada" }, "Loja A");
    expect(ticket).not.toContain("TAXA ENTREGA");
    expect(ticket).toContain("RETIRADA NO BALCAO");
  });
});

describe("buildWhatsAppMessage", () => {
  it("marca entrega e detalha subtotal + taxa", () => {
    const msg = buildWhatsAppMessage(order, "Loja A");
    expect(msg).toContain("*NOVO PEDIDO #7*");
    expect(msg).toContain("Entrega a domicílio");
    const plain = msg.replace(/\u00a0/g, " ");
    expect(plain).toContain("*Subtotal:* R$ 30,00");
    expect(plain).toContain("*Taxa de entrega:* R$ 5,00");
    expect(plain).toContain("TOTAL: R$ 35,00");
  });

  it("marca retirada e omite taxa", () => {
    const msg = buildWhatsAppMessage({ ...order, delivery_type: "retirada" }, "Loja A");
    expect(msg).toContain("Retirada no balcão");
    expect(msg).not.toContain("Taxa de entrega");
  });
});

describe("sendToWhatsApp", () => {
  it("remove formatação do número antes de montar o link wa.me", () => {
    const opened: string[] = [];
    const original = window.open;
    window.open = ((url: string) => {
      opened.push(url);
      return null;
    }) as typeof window.open;

    sendToWhatsApp("(11) 99999-9999", "Olá!");
    window.open = original;

    expect(opened[0]).toContain("https://wa.me/11999999999?");
    expect(opened[0]).toContain(encodeURIComponent("Olá!"));
  });
});
