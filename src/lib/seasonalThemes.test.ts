import { describe, it, expect } from "vitest";
import {
  easterSunday,
  getActiveThemes,
  getPrimaryTheme,
  buildSeasonalOffer,
  suggestOffers,
  themeByKey,
  nicheByKey,
  inferNiche,
  NICHES,
  SEASONAL_THEMES,
} from "./seasonalThemes";

describe("easterSunday (datas móveis)", () => {
  it("calcula a Páscoa de anos conhecidos", () => {
    expect(easterSunday(2024).toISOString().slice(0, 10)).toBe("2024-03-31");
    expect(easterSunday(2025).toISOString().slice(0, 10)).toBe("2025-04-20");
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
  });
});

describe("getPrimaryTheme", () => {
  it("veste Natal em dezembro", () => {
    expect(getPrimaryTheme(new Date(2026, 11, 20))?.key).toBe("natal");
  });

  it("veste Carnaval na terça (data móvel)", () => {
    // Carnaval 2026: terça de 17/02 (Páscoa 05/04 − 47 dias).
    expect(getPrimaryTheme(new Date(2026, 1, 17))?.key).toBe("carnaval");
  });

  it("veste Festa Junina no meio de junho", () => {
    expect(getPrimaryTheme(new Date(2026, 5, 20))?.key).toBe("festa-junina");
  });

  it("veste Independência no 7 de setembro", () => {
    expect(getPrimaryTheme(new Date(2026, 8, 7))?.key).toBe("independencia");
  });

  it("não veste nada numa semana sem data", () => {
    expect(getPrimaryTheme(new Date(2026, 2, 10))).toBeNull(); // 10/mar
  });
});

describe("getActiveThemes", () => {
  it("Natal vence a Black Friday quando as janelas se sobrepõem", () => {
    // Black Friday 2026 = 27/11; Natal começa em 15/11. Nos dois, Natal manda.
    const active = getActiveThemes(new Date(2026, 10, 28));
    expect(active[0].key).toBe("natal");
    expect(active.map((t) => t.key)).toContain("black-friday");
  });

  it("devolve os temas ordenados por prioridade", () => {
    const active = getActiveThemes(new Date(2026, 11, 20));
    const priorities = active.map((t) => t.priority);
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities);
  });
});

describe("buildSeasonalOffer (nicho × data)", () => {
  it("monta 'Natal na Pizzaria' com cor do tema e ideias somadas", () => {
    const pizza = nicheByKey("pizzaria")!;
    const natal = themeByKey("natal")!;
    const offer = buildSeasonalOffer(pizza, natal);
    expect(offer.title).toBe("Natal na Pizzaria");
    expect(offer.primary).toBe(natal.primary);
    expect(offer.menuIdeas).toContain("Pizza especial");
    expect(offer.menuIdeas).toContain("Ceia de Natal");
    expect(offer.cta).toContain("nesse Natal");
  });

  it("não repete ideia que o tema e o nicho tenham em comum", () => {
    const doceria = nicheByKey("doceria")!;
    const pascoa = themeByKey("pascoa")!;
    const offer = buildSeasonalOffer(doceria, pascoa);
    expect(new Set(offer.menuIdeas).size).toBe(offer.menuIdeas.length);
  });
});

describe("suggestOffers", () => {
  it("põe o tema ativo na frente e completa com os próximos", () => {
    const offers = suggestOffers("hamburgueria", new Date(2026, 11, 20));
    expect(offers[0].theme.key).toBe("natal");
    expect(offers.length).toBe(4);
    expect(offers[0].niche.key).toBe("hamburgueria");
  });

  it("sem tema ativo, ainda devolve ofertas (as próximas do ano)", () => {
    const offers = suggestOffers("pizzaria", new Date(2026, 2, 10));
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.niche.key === "pizzaria")).toBe(true);
  });

  it("nicho desconhecido cai no primeiro nicho, sem quebrar", () => {
    const offers = suggestOffers("nao-existe", new Date(2026, 11, 20));
    expect(offers[0].niche.key).toBe(NICHES[0].key);
  });
});

describe("inferNiche", () => {
  it("reconhece pizzaria e hamburgueria pelo nome", () => {
    expect(inferNiche("Pizzaria do Zé").key).toBe("pizzaria");
    expect(inferNiche("Burger House").key).toBe("hamburgueria");
    expect(inferNiche("Sushi Yamato").key).toBe("japonesa");
  });

  it("cai em comida caseira quando não há pista", () => {
    expect(inferNiche("Cantina da Pracinha").key).toBe("comida-caseira");
  });
});

describe("integridade do catálogo", () => {
  it("toda chave de tema é única", () => {
    const keys = SEASONAL_THEMES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("todo tema tem cor, headline e pelo menos uma ideia", () => {
    for (const t of SEASONAL_THEMES) {
      expect(t.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.secondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.headline.length).toBeGreaterThan(0);
      expect(t.menuIdeas.length).toBeGreaterThan(0);
    }
  });

  it("cada tema cai na própria janela em algum dia do ano", () => {
    const year = 2026;
    for (const t of SEASONAL_THEMES) {
      let hit = false;
      for (let day = 0; day < 366 && !hit; day++) {
        const d = new Date(year, 0, 1 + day);
        if (d.getFullYear() !== year) break;
        if (t.inWindow(d)) hit = true;
      }
      expect(hit, `tema ${t.key} nunca ativa`).toBe(true);
    }
  });
});
