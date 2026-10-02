import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { normalizePreapproval, verifyMercadoPagoSignature } from "./mercadopago";

function sign(dataId: string, requestId: string, ts: string, secret: string): string {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("verifyMercadoPagoSignature", () => {
  const secret = "super-secret-key";

  it("aceita uma assinatura válida", async () => {
    const signature = sign("123456", "req-1", "1700000000", secret);
    await expect(
      verifyMercadoPagoSignature({
        signature,
        requestId: "req-1",
        dataId: "123456",
        secret,
      }),
    ).resolves.toBe(true);
  });

  it("normaliza o id para minúsculas no manifesto", async () => {
    // O Mercado Pago envia data.id em minúsculas no manifesto mesmo quando o
    // valor no corpo tem maiúsculas.
    const signature = sign("AbC123", "req-2", "1700000000", secret);
    await expect(
      verifyMercadoPagoSignature({
        signature,
        requestId: "req-2",
        dataId: "ABC123",
        secret,
      }),
    ).resolves.toBe(true);
  });

  it("rejeita assinatura com secret errado", async () => {
    const signature = sign("123456", "req-1", "1700000000", "outro-secret");
    await expect(
      verifyMercadoPagoSignature({
        signature,
        requestId: "req-1",
        dataId: "123456",
        secret,
      }),
    ).resolves.toBe(false);
  });

  it("rejeita quando o data.id não confere", async () => {
    const signature = sign("123456", "req-1", "1700000000", secret);
    await expect(
      verifyMercadoPagoSignature({
        signature,
        requestId: "req-1",
        dataId: "999999",
        secret,
      }),
    ).resolves.toBe(false);
  });

  it("rejeita sem secret, sem assinatura ou malformada", async () => {
    await expect(
      verifyMercadoPagoSignature({ signature: null, requestId: "r", dataId: "1", secret }),
    ).resolves.toBe(false);
    await expect(
      verifyMercadoPagoSignature({ signature: "ts=1,v1=aa", requestId: "r", dataId: "1", secret }),
    ).resolves.toBe(false);
    await expect(
      verifyMercadoPagoSignature({
        signature: "lixo",
        requestId: "r",
        dataId: "1",
        secret,
      }),
    ).resolves.toBe(false);
  });
});

describe("normalizePreapproval", () => {
  it("extrai id, status, pagador e renovação", () => {
    const info = normalizePreapproval({
      id: "2c938084",
      status: "authorized",
      payer_email: "dono@loja.com",
      external_reference: "minha-loja",
      next_payment_date: "2026-05-01T00:00:00.000Z",
    });
    expect(info).toEqual({
      id: "2c938084",
      status: "authorized",
      payerEmail: "dono@loja.com",
      externalReference: "minha-loja",
      nextPaymentDate: "2026-05-01T00:00:00.000Z",
    });
  });

  it("retorna null sem id", () => {
    expect(normalizePreapproval({ status: "authorized" })).toBeNull();
    expect(normalizePreapproval(null)).toBeNull();
  });
});
