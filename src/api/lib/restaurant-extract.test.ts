import { describe, expect, it } from "vitest";
import { normalizePhone, normalizeFee, parseRestaurantText } from "@/api/lib/restaurant-extract";

describe("normalizePhone", () => {
  it("adiciona o DDI 55 em número brasileiro sem DDI", () => {
    expect(normalizePhone("(48) 99999-9999")).toBe("5548999999999");
    expect(normalizePhone("48999999999")).toBe("5548999999999");
  });

  it("mantém o número que já tem DDI", () => {
    expect(normalizePhone("5548999999999")).toBe("5548999999999");
  });

  it("rejeita número curto/longo demais", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("12345678901234567")).toBeNull();
  });
});

describe("normalizeFee", () => {
  it("normaliza vírgula e símbolo", () => {
    expect(normalizeFee("5")).toBe("5.00");
    expect(normalizeFee("5,50")).toBe("5.50");
    expect(normalizeFee("R$ 7.00")).toBe("7.00");
  });

  it("rejeita valor implausível", () => {
    expect(normalizeFee("abc")).toBeNull();
    expect(normalizeFee("5000")).toBeNull();
  });
});

describe("parseRestaurantText (determinístico, sem IA)", () => {
  it("extrai nome, whatsapp, taxa e pix de um bloco de texto", () => {
    const fields = parseRestaurantText(
      "Cantina da Pracinha\nRua das Flores 123, centro\nWhatsApp (48) 99999-9999\nEntrega R$ 5\nPIX cantina@email.com",
    );
    expect(fields.name).toBe("Cantina da Pracinha");
    expect(fields.whatsapp).toBe("5548999999999");
    expect(fields.delivery_fee).toBe("5.00");
    expect(fields.pix_key).toBe("cantina@email.com");
  });

  it("separa nome e slogan quando há travessão", () => {
    const fields = parseRestaurantText("Cantina da Pracinha - massas artesanais desde 2018");
    expect(fields.name).toBe("Cantina da Pracinha");
    expect(fields.description).toBe("massas artesanais desde 2018");
  });

  it("texto vazio não inventa nada", () => {
    expect(parseRestaurantText("")).toEqual({});
    expect(parseRestaurantText("   ")).toEqual({});
  });
});
