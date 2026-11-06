import { describe, expect, it } from "vitest";
import {
  CHAT_STEPS,
  COLOR_PRESETS,
  HOURS_PRESETS,
  isReviewStep,
  normalizeDeliveryFee,
  parseNeighborhoodLine,
  normalizeWhatsapp,
  validateAnswer,
} from "@/lib/restaurantChat";

describe("normalizeWhatsapp", () => {
  it("adiciona DDI 55 quando falta", () => {
    expect(normalizeWhatsapp("(48) 99999-9999")).toBe("5548999999999");
    expect(normalizeWhatsapp("48 99999-9999")).toBe("5548999999999");
  });

  it("mantém o número que já tem DDI", () => {
    expect(normalizeWhatsapp("5548999999999")).toBe("5548999999999");
  });

  it("recusa número curto ou longo demais", () => {
    expect(normalizeWhatsapp("123")).toBeNull();
    expect(normalizeWhatsapp("1234567890123456")).toBeNull();
  });
});

describe("normalizeDeliveryFee", () => {
  it("aceita vírgula e prefixo de moeda", () => {
    expect(normalizeDeliveryFee("5")).toBe("5.00");
    expect(normalizeDeliveryFee("R$ 5,00")).toBe("5.00");
    expect(normalizeDeliveryFee("7.5")).toBe("7.50");
  });

  it("recusa valor fora da faixa", () => {
    expect(normalizeDeliveryFee("abc")).toBeNull();
    expect(normalizeDeliveryFee("5000")).toBeNull();
  });
});

describe("validateAnswer", () => {
  const name = CHAT_STEPS.find((s) => s.field === "name")!;
  const whatsapp = CHAT_STEPS.find((s) => s.field === "whatsapp")!;
  const description = CHAT_STEPS.find((s) => s.field === "description")!;

  it("exige o nome e recusa vazio", () => {
    expect(validateAnswer(name, "").ok).toBe(false);
    expect(validateAnswer(name, "A").ok).toBe(false);
    expect(validateAnswer(name, "Cantina").ok).toBe(true);
  });

  it("normaliza o WhatsApp", () => {
    const res = validateAnswer(whatsapp, "(48) 99999-9999");
    expect(res.ok).toBe(true);
    expect(res.value).toBe("5548999999999");
  });

  it("devolve erro em telefone inválido", () => {
    const res = validateAnswer(whatsapp, "abc");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/inválido/i);
  });

  it("aceita vazio em passo opcional", () => {
    expect(validateAnswer(description, "").ok).toBe(true);
  });
});

describe("CHAT_STEPS", () => {
  it("o primeiro passo é o nome (obrigatório)", () => {
    expect(CHAT_STEPS[0].field).toBe("name");
    expect(CHAT_STEPS[0].optional).toBeFalsy();
  });

  it("o passo de cor traz opções", () => {
    const color = CHAT_STEPS.find((s) => s.field === "primary_color")!;
    expect(color.kind).toBe("choice");
    expect(color.choices?.length).toBeGreaterThan(1);
    for (const c of color.choices ?? []) expect(COLOR_PRESETS[c.value]).toBeTruthy();
  });

  it("o passo de horário traz presets válidos ou skip", () => {
    const hours = CHAT_STEPS.find((s) => s.field === "operating_hours")!;
    for (const c of hours.choices ?? []) {
      if (c.value !== "skip") expect(HOURS_PRESETS[c.value]).toBeTruthy();
    }
  });

  it("isReviewStep só é verdadeiro depois do último passo", () => {
    expect(isReviewStep(0)).toBe(false);
    expect(isReviewStep(CHAT_STEPS.length - 1)).toBe(false);
    expect(isReviewStep(CHAT_STEPS.length)).toBe(true);
  });
});

describe("parseNeighborhoodLine", () => {
  it("separa nome e valor", () => {
    expect(parseNeighborhoodLine("Centro 5")).toEqual({ name: "Centro", fee: "5.00" });
    expect(parseNeighborhoodLine("Trindade - 8,50")).toEqual({ name: "Trindade", fee: "8.50" });
    expect(parseNeighborhoodLine("Jurerê: 12")).toEqual({ name: "Jurerê", fee: "12.00" });
  });

  it("aceita bairro sem valor (usa a taxa padrão)", () => {
    expect(parseNeighborhoodLine("Centro")).toEqual({ name: "Centro", fee: "" });
  });

  it("devolve null para linha vazia", () => {
    expect(parseNeighborhoodLine("   ")).toBeNull();
  });
});

describe("presets", () => {
  it("o preset de almoço abre 11h e fecha 15h", () => {
    expect(HOURS_PRESETS.almoco.seg).toEqual({ closed: false, open: "11:00", close: "15:00" });
  });

  it("o preset sem domingo fecha no domingo", () => {
    expect(HOURS_PRESETS["noite-sem-dom"].dom.closed).toBe(true);
    expect(HOURS_PRESETS["noite-sem-dom"].sab.closed).toBe(false);
  });
});
