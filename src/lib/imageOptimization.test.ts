import { describe, expect, it } from "vitest";
import {
  IMAGE_SIZES,
  imageSrcSet,
  isSupabaseStorageUrl,
  optimizedImageUrl,
} from "@/lib/imageOptimization";

const STORAGE_URL =
  "https://abcd.supabase.co/storage/v1/object/public/restaurant-images/rest1/logo_123.png";
const EXTERNAL_URL = "https://exemplo.com/foto.jpg";

describe("isSupabaseStorageUrl", () => {
  it("reconhece bucket de imagens do Supabase", () => {
    expect(isSupabaseStorageUrl(STORAGE_URL)).toBe(true);
  });

  it("rejeita URL externa, vazia ou inválida", () => {
    expect(isSupabaseStorageUrl(EXTERNAL_URL)).toBe(false);
    expect(isSupabaseStorageUrl("")).toBe(false);
    expect(isSupabaseStorageUrl("nao-e-url")).toBe(false);
  });

  it("rejeita bucket diferente do de imagens", () => {
    expect(
      isSupabaseStorageUrl("https://abcd.supabase.co/storage/v1/object/public/outro-bucket/a.png"),
    ).toBe(false);
  });
});

describe("optimizedImageUrl", () => {
  it("troca a rota object pela de render com parâmetros", () => {
    const url = optimizedImageUrl(STORAGE_URL, { width: 100, height: 100, quality: 80 });
    expect(url).toContain("/storage/v1/render/image/public/");
    expect(url).toContain("width=100");
    expect(url).toContain("height=100");
    expect(url).toContain("quality=80");
    expect(url).toContain("resize=cover");
  });

  it("usa qualidade padrão de 75 e limitar a faixa 20..100", () => {
    expect(optimizedImageUrl(STORAGE_URL, { width: 50 })).toContain("quality=75");
    expect(optimizedImageUrl(STORAGE_URL, { width: 50, quality: 5 })).toContain("quality=20");
    expect(optimizedImageUrl(STORAGE_URL, { width: 50, quality: 999 })).toContain("quality=100");
  });

  it("preserva a URL externa e a sem dimensões", () => {
    expect(optimizedImageUrl(EXTERNAL_URL, { width: 100 })).toBe(EXTERNAL_URL);
    expect(optimizedImageUrl(STORAGE_URL, {})).toBe(STORAGE_URL);
  });

  it("não quebra com url inválida", () => {
    expect(optimizedImageUrl("nao-e-url", { width: 10 })).toBe("nao-e-url");
  });
});

describe("imageSrcSet", () => {
  it("gera 1x e 2x para Storage do Supabase", () => {
    const srcSet = imageSrcSet(STORAGE_URL, 100);
    expect(srcSet).toContain("width=100");
    expect(srcSet).toContain("width=200");
    expect(srcSet).toContain("1x");
    expect(srcSet).toContain("2x");
  });

  it("devolve undefined para imagem externa", () => {
    expect(imageSrcSet(EXTERNAL_URL, 100)).toBeUndefined();
  });
});

describe("IMAGE_SIZES", () => {
  it("mantém a miniatura alinhada ao layout atual", () => {
    expect(IMAGE_SIZES.thumb).toBe(68);
  });
});
