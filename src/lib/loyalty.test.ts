import { describe, expect, it } from "vitest";
import { describePromotion, isRedeemable, PROMOTION_KIND_LABELS, type Promotion } from "./loyalty";

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: "p1",
    title: "Recompensa",
    description: "",
    kind: "reward",
    value: 10,
    ends_at: null,
    ...overrides,
  };
}

describe("isRedeemable", () => {
  it("só recompensa com valor positivo pode ser resgatada", () => {
    expect(isRedeemable(promo())).toBe(true);
    expect(isRedeemable(promo({ kind: "discount", value: 10 }))).toBe(false);
    expect(isRedeemable(promo({ kind: "points_multiplier", value: 2 }))).toBe(false);
    expect(isRedeemable(promo({ value: 0 }))).toBe(false);
  });
});

describe("describePromotion", () => {
  it("explica pontos em dobro", () => {
    expect(describePromotion(promo({ kind: "points_multiplier", value: 2 }))).toBe(
      "Ganhe 2x pontos nos pedidos",
    );
  });

  it("explica bônus de pontos", () => {
    expect(describePromotion(promo({ kind: "bonus_points", value: 5 }))).toBe(
      "Ganhe 5 pontos extras",
    );
  });

  it("explica desconto percentual", () => {
    expect(describePromotion(promo({ kind: "discount", value: 15 }))).toBe("15% de desconto");
  });

  it("explica o custo do resgate", () => {
    expect(describePromotion(promo({ kind: "reward", value: 30 }))).toBe(
      "Troque 30 SOV por esta recompensa",
    );
  });
});

describe("PROMOTION_KIND_LABELS", () => {
  it("tem rótulo para todos os tipos, para a UI nunca mostrar a chave crua", () => {
    for (const kind of ["points_multiplier", "bonus_points", "reward", "discount"] as const) {
      expect(PROMOTION_KIND_LABELS[kind]).toBeTruthy();
      expect(PROMOTION_KIND_LABELS[kind]).not.toContain("_");
    }
  });
});
