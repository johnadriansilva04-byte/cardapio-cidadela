import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  authorizeWebhookRequest,
  getWebhookAllowUnsigned,
  normalizePreapproval,
  verifyMercadoPagoSignature,
} from "./mercadopago";

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

describe("authorizeWebhookRequest", () => {
  const secret = "super-secret-key";

  it("recusa quando o secret não está configurado (fail-closed)", async () => {
    // O buraco antigo: sem secret o webhook processava a notificação, então
    // qualquer um forjava um POST e ativava o Premium de graça.
    const result = await authorizeWebhookRequest({
      secret: "",
      signature: null,
      requestId: null,
      dataId: null,
      authorization: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/não configurado/);
  });

  it("libera sem secret só quando allowUnsigned está ligado (dev)", async () => {
    await expect(
      authorizeWebhookRequest({
        secret: "",
        signature: null,
        requestId: null,
        dataId: null,
        authorization: null,
        allowUnsigned: true,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("aceita Bearer <secret>", async () => {
    await expect(
      authorizeWebhookRequest({
        secret,
        signature: null,
        requestId: null,
        dataId: null,
        authorization: `Bearer ${secret}`,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("aceita x-signature HMAC válido", async () => {
    const signature = sign("123456", "req-9", "1700000000", secret);
    await expect(
      authorizeWebhookRequest({
        secret,
        signature,
        requestId: "req-9",
        dataId: "123456",
        authorization: null,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("recusa sem nenhuma credencial quando há secret", async () => {
    const result = await authorizeWebhookRequest({
      secret,
      signature: null,
      requestId: null,
      dataId: null,
      authorization: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid signature");
  });

  it("recusa Bearer com secret errado e HMAC forjado", async () => {
    await expect(
      authorizeWebhookRequest({
        secret,
        signature: sign("123456", "req-9", "1700000000", "outro"),
        requestId: "req-9",
        dataId: "123456",
        authorization: "Bearer outro",
      }),
    ).resolves.toEqual({ ok: false, reason: "invalid signature" });
  });

  it("allowUnsigned NÃO afrouxa quando o secret existe", async () => {
    // allowUnsigned é só para o caso "sem secret"; com secret a assinatura
    // continua obrigatória.
    await expect(
      authorizeWebhookRequest({
        secret,
        signature: null,
        requestId: null,
        dataId: null,
        authorization: null,
        allowUnsigned: true,
      }),
    ).resolves.toEqual({ ok: false, reason: "invalid signature" });
  });
});

describe("getWebhookAllowUnsigned", () => {
  it("só liga com 1/true/yes (case-insensitive)", () => {
    expect(getWebhookAllowUnsigned({ MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED: "1" })).toBe(true);
    expect(getWebhookAllowUnsigned({ MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED: "TRUE" })).toBe(true);
    expect(getWebhookAllowUnsigned({ MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED: "yes" })).toBe(true);
    expect(getWebhookAllowUnsigned({ MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED: "0" })).toBe(false);
    expect(getWebhookAllowUnsigned({})).toBe(false);
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
