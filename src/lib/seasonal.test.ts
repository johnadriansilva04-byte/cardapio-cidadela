import { describe, it, expect } from "vitest";
import { isChristmasSeason } from "./seasonal";

describe("isChristmasSeason", () => {
  it("é Natal em novembro e dezembro", () => {
    expect(isChristmasSeason(new Date(2026, 10, 1))).toBe(true); // nov
    expect(isChristmasSeason(new Date(2026, 11, 25))).toBe(true); // dez
  });

  it("não é Natal no resto do ano", () => {
    for (const month of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(isChristmasSeason(new Date(2026, month, 15))).toBe(false);
    }
  });

  it("liga já no primeiro dia de novembro e desliga no primeiro de janeiro", () => {
    expect(isChristmasSeason(new Date(2026, 9, 31))).toBe(false); // 31/out
    expect(isChristmasSeason(new Date(2026, 10, 1))).toBe(true); // 01/nov
    expect(isChristmasSeason(new Date(2026, 11, 31))).toBe(true); // 31/dez
    expect(isChristmasSeason(new Date(2027, 0, 1))).toBe(false); // 01/jan
  });
});
