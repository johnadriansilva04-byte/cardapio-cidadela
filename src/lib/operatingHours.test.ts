import { describe, it, expect } from "vitest";
import { isOpenNow, normalizeOperatingHours, type OperatingHours } from "./operatingHours";

function hoursWith(overrides: Partial<OperatingHours>): OperatingHours {
  const base = normalizeOperatingHours(null);
  for (const day of Object.keys(overrides) as (keyof OperatingHours)[]) {
    base[day] = overrides[day]!;
  }
  return base;
}

// 2026-01-05 é segunda-feira; 2026-01-06 terça; 2026-01-04 domingo.
const MONDAY_23H = new Date(2026, 0, 5, 23, 0);
const TUESDAY_01H = new Date(2026, 0, 6, 1, 0);
const TUESDAY_12H = new Date(2026, 0, 6, 12, 0);

describe("isOpenNow", () => {
  it("trata ausência de horário como sempre aberto", () => {
    expect(isOpenNow(null)).toBe(true);
    expect(isOpenNow(undefined)).toBe(true);
  });

  it("respeita o horário do dia", () => {
    const hours = hoursWith({
      ter: { closed: false, open: "11:00", close: "15:00" },
    });
    expect(isOpenNow(hours, TUESDAY_12H)).toBe(true);
  });

  it("fecha fora do horário", () => {
    const hours = hoursWith({
      ter: { closed: false, open: "11:00", close: "15:00" },
    });
    expect(isOpenNow(hours, TUESDAY_01H)).toBe(false);
  });

  it("fecha quando o dia está marcado como fechado", () => {
    const hours = hoursWith({
      ter: { closed: true, open: "11:00", close: "15:00" },
    });
    expect(isOpenNow(hours, TUESDAY_12H)).toBe(false);
  });

  it("considera 24h quando abre e fecha no mesmo horário", () => {
    const hours = hoursWith({
      ter: { closed: false, open: "00:00", close: "00:00" },
    });
    expect(isOpenNow(hours, TUESDAY_01H)).toBe(true);
    expect(isOpenNow(hours, TUESDAY_12H)).toBe(true);
  });

  it("abre na madrugada quando o horário cruza a meia-noite", () => {
    const hours = hoursWith({
      seg: { closed: false, open: "22:00", close: "02:00" },
    });
    expect(isOpenNow(hours, MONDAY_23H)).toBe(true);
    // 01:00 de terça ainda pertence ao expediente de segunda.
    expect(isOpenNow(hours, TUESDAY_01H)).toBe(true);
  });

  it("não estende a madrugada quando ontem não cruzava a meia-noite", () => {
    const hours = hoursWith({
      seg: { closed: false, open: "11:00", close: "15:00" },
    });
    expect(isOpenNow(hours, TUESDAY_01H)).toBe(false);
  });
});
