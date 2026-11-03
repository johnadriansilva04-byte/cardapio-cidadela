import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  readMenuCache,
  writeMenuCache,
  clearMenuCache,
  menuCacheAge,
  MENU_CACHE_TTL_MS,
} from "./menuCache";
import type { Restaurant } from "@/lib/types";

function makeRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: "r1",
    owner_id: "o1",
    name: "Lanchonete",
    slug: "lanchonete",
    description: "",
    phone: "",
    whatsapp: "",
    address: "",
    logo_url: "",
    banner_url: "",
    primary_color: "#000",
    secondary_color: "#fff",
    status: "published",
    pix_key: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeSnapshot() {
  return {
    restaurant: makeRestaurant(),
    categories: [{ id: "c1", restaurant_id: "r1", name: "Lanches", sort_order: 0, created_at: "" }],
    products: [],
    neighborhoods: [],
    addons: [],
  };
}

describe("menuCache", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("devolve null quando não há cache", () => {
    expect(readMenuCache("lanchonete")).toBeNull();
    expect(menuCacheAge("lanchonete")).toBeNull();
  });

  it("faz round-trip do snapshot e carimba a idade", () => {
    writeMenuCache("lanchonete", makeSnapshot());
    const cached = readMenuCache("lanchonete");
    expect(cached?.restaurant.slug).toBe("lanchonete");
    expect(cached?.categories).toHaveLength(1);
    expect(typeof cached?.cachedAt).toBe("number");
    expect(menuCacheAge("lanchonete")).toBeGreaterThanOrEqual(0);
  });

  it("isola por slug", () => {
    writeMenuCache("a", makeSnapshot());
    expect(readMenuCache("b")).toBeNull();
  });

  it("expira depois do TTL", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    writeMenuCache("lanchonete", makeSnapshot());
    expect(readMenuCache("lanchonete")).not.toBeNull();

    vi.spyOn(Date, "now").mockReturnValue(now + MENU_CACHE_TTL_MS + 1);
    expect(readMenuCache("lanchonete")).toBeNull();
  });

  it("ignora payload corrompido", () => {
    localStorage.setItem("cidadela:menu:v1:lanchonete", "{not json");
    expect(readMenuCache("lanchonete")).toBeNull();
  });

  it("ignora payload sem restaurante", () => {
    localStorage.setItem("cidadela:menu:v1:lanchonete", JSON.stringify({ cachedAt: Date.now() }));
    expect(readMenuCache("lanchonete")).toBeNull();
  });

  it("clearMenuCache remove o registro", () => {
    writeMenuCache("lanchonete", makeSnapshot());
    clearMenuCache("lanchonete");
    expect(readMenuCache("lanchonete")).toBeNull();
  });
});
