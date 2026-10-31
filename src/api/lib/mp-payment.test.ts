import { describe, expect, it, vi, afterEach } from "vitest";
import { buildPreapprovalBody, cancelPreapproval } from "./mp-payment";

/**
 * A assinatura recorrente depende do formato exato do preapproval — é o
 * contrato com o Mercado Pago que, se errado, ou não cobra, ou cobra o valor
 * errado. Por isso o corpo é montado por uma função pura e testado aqui.
 */
describe("buildPreapprovalBody", () => {
  it("monta o ciclo mensal com o valor informado", () => {
    const body = buildPreapprovalBody({
      reason: "Premium mensal",
      externalReference: "store-1",
      unitPrice: 28.99,
    });

    expect(body.reason).toBe("Premium mensal");
    expect(body.external_reference).toBe("store-1");
    expect(body.status).toBe("pending");
    expect(body.auto_recurring).toEqual({
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 28.99,
      currency_id: "BRL",
    });
  });

  it("usa 12 meses quando o ciclo é anual", () => {
    const body = buildPreapprovalBody({
      reason: "Premium anual",
      externalReference: "store-1",
      unitPrice: 199.99,
      frequency: 12,
    });
    expect((body.auto_recurring as Record<string, unknown>).frequency).toBe(12);
  });

  it("omite campos opcionais quando não informados", () => {
    const body = buildPreapprovalBody({
      reason: "Premium",
      externalReference: "store-1",
      unitPrice: 10,
    });
    expect(body).not.toHaveProperty("payer_email");
    expect(body).not.toHaveProperty("back_url");
    expect(body).not.toHaveProperty("notification_url");
  });

  it("inclui o e-mail do pagador quando informado", () => {
    const body = buildPreapprovalBody({
      reason: "Premium",
      externalReference: "store-1",
      unitPrice: 10,
      payerEmail: "dono@exemplo.com",
    });
    expect(body.payer_email).toBe("dono@exemplo.com");
  });
});

describe("cancelPreapproval", () => {
  afterEach(() => vi.unstubAllGlobals());

  const env = { MERCADOPAGO_ACCESS_TOKEN: "tok" };

  it("manda PUT com status cancelled para o preapproval certo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const ok = await cancelPreapproval("preap-123", env);

    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.mercadopago.com/preapproval/preap-123");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ status: "cancelled" });
  });

  it("devolve false quando o Mercado Pago recusa", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await expect(cancelPreapproval("preap-123", env)).resolves.toBe(false);
  });

  it("não chama a API sem id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(cancelPreapproval("", env)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
