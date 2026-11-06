import { describe, expect, it } from "vitest";
import {
  PLANS,
  PLAN_ORDER,
  PLAN_FEATURES,
  planAllowsPhotoScan,
  planHasFeature,
  PHOTO_SCAN_UPSELL,
} from "@/lib/plans";

describe("plans", () => {
  it("o anual é o único que libera a leitura por foto", () => {
    expect(planAllowsPhotoScan("annual")).toBe(true);
    expect(planAllowsPhotoScan("monthly")).toBe(false);
    expect(planAllowsPhotoScan("free")).toBe(false);
  });

  it("o anual inclui tudo do mensal", () => {
    for (const feature of PLANS.monthly.features) {
      expect(PLANS.annual.features).toContain(feature);
    }
  });

  it("o mensal inclui o chat de montagem e o gratuito não", () => {
    expect(planHasFeature("monthly", "chat_setup")).toBe(true);
    expect(planHasFeature("annual", "chat_setup")).toBe(true);
    expect(planHasFeature("free", "chat_setup")).toBe(false);
  });

  it("todo recurso citado tem texto em PLAN_FEATURES", () => {
    for (const key of PLAN_ORDER) {
      for (const feature of PLANS[key].features) {
        expect(PLAN_FEATURES[feature]).toBeTruthy();
      }
    }
  });

  it("o anual sai mais barato por mês que o mensal", () => {
    expect(PLANS.annual.priceValue / 12).toBeLessThan(PLANS.monthly.priceValue);
  });

  it("o aviso de upgrade cita o anual", () => {
    expect(PHOTO_SCAN_UPSELL).toMatch(/Anual/);
  });
});
