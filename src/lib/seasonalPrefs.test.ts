import { describe, it, expect, beforeEach } from "vitest";
import {
  loadSeasonalPrefs,
  markThemeAdopted,
  markThemeDismissed,
  setSeasonalEnabled,
  shouldOfferTheme,
} from "./seasonalPrefs";

describe("seasonalPrefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("começa ligado, sem temas adotados ou dispensados", () => {
    const prefs = loadSeasonalPrefs();
    expect(prefs.enabled).toBe(true);
    expect(prefs.adopted).toEqual([]);
    expect(prefs.dismissed).toEqual({});
  });

  it("adotar um tema marca e some com a dispensa do ano", () => {
    markThemeDismissed("natal", 2026);
    const prefs = markThemeAdopted("natal");
    expect(prefs.adopted).toContain("natal");
    expect(prefs.dismissed.natal).toBeUndefined();
    expect(shouldOfferTheme("natal", 2026, prefs)).toBe(false);
  });

  it("dispensar vale só para o ano — volta a ser oferecido no ano seguinte", () => {
    markThemeDismissed("carnaval", 2026);
    expect(shouldOfferTheme("carnaval", 2026)).toBe(false);
    expect(shouldOfferTheme("carnaval", 2027)).toBe(true);
  });

  it("desligar os avisos silencia tudo", () => {
    setSeasonalEnabled(false);
    expect(shouldOfferTheme("natal", 2026)).toBe(false);
    setSeasonalEnabled(true);
    expect(shouldOfferTheme("natal", 2026)).toBe(true);
  });

  it("sobrevive a um valor corrompido no storage", () => {
    localStorage.setItem("cidadela:seasonal-prefs", "{isso não é json");
    const prefs = loadSeasonalPrefs();
    expect(prefs.enabled).toBe(true);
    expect(prefs.adopted).toEqual([]);
  });
});
