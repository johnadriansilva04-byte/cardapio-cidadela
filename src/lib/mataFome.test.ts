import { describe, it, expect } from "vitest";
import { MATA_FOME, isMataFomeOn, mataFomeNote } from "./mataFome";

describe("MATA FOME", () => {
  it("só liga quando o dono aderiu", () => {
    expect(isMataFomeOn({ mata_fome_enabled: true })).toBe(true);
    expect(isMataFomeOn({ mata_fome_enabled: false })).toBe(false);
    expect(isMataFomeOn({})).toBe(false);
    expect(isMataFomeOn(null)).toBe(false);
  });

  it("normaliza o recado do dono e trata vazio/nulo", () => {
    expect(mataFomeNote({ mata_fome_note: "  só até as 19h  " })).toBe("só até as 19h");
    expect(mataFomeNote({ mata_fome_note: "   " })).toBe("");
    expect(mataFomeNote({})).toBe("");
    expect(mataFomeNote(null)).toBe("");
  });

  it("o convite é genérico — não padroniza um item", () => {
    expect(MATA_FOME.title.toLowerCase()).toContain("mata fome");
    expect(MATA_FOME.subtitle.toLowerCase()).toContain("qualquer item");
  });
});
