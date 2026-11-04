import { describe, it, expect, vi } from "vitest";
import {
  getImagesBinding,
  isR2Url,
  r2KeyFromUrl,
  r2PublicUrl,
  putR2Image,
  deleteR2Image,
  R2_PUBLIC_BASE,
  type R2BucketLike,
} from "@/api/lib/r2-images";

function fakeRequest(env: Record<string, unknown>): Request {
  const req = new Request("https://example.com/");
  (req as unknown as { runtime: unknown }).runtime = { cloudflare: { env } };
  return req;
}

function fakeBucket(): R2BucketLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async put(key, value) {
      store.set(key, typeof value === "string" ? value : "binary");
      return undefined;
    },
    async get(key) {
      return store.has(key) ? { body: null } : null;
    },
    async delete(key) {
      store.delete(key);
    },
    async list() {
      return { objects: [...store.keys()].map((key) => ({ key })), truncated: false };
    },
  };
}

describe("getImagesBinding", () => {
  it("devolve o bucket quando o binding IMAGES existe", () => {
    const bucket = fakeBucket();
    expect(getImagesBinding(fakeRequest({ IMAGES: bucket }))).toBe(bucket);
  });

  it("devolve null sem runtime (dev local)", () => {
    expect(getImagesBinding(new Request("https://example.com/"))).toBeNull();
  });

  it("devolve null quando o binding tem a forma errada", () => {
    expect(getImagesBinding(fakeRequest({ IMAGES: { foo: 1 } }))).toBeNull();
  });
});

describe("URLs do R2", () => {
  it("monta a URL pública", () => {
    expect(r2PublicUrl("abc/logo_1.jpg")).toBe(`${R2_PUBLIC_BASE}/abc/logo_1.jpg`);
  });

  it("reconhece só o domínio do R2", () => {
    expect(isR2Url(`${R2_PUBLIC_BASE}/x/y.webp`)).toBe(true);
    expect(isR2Url("https://xyz.supabase.co/storage/v1/object/public/a/b.png")).toBe(false);
    expect(isR2Url("")).toBe(false);
  });

  it("extrai a chave da URL e ignora outros hosts", () => {
    expect(r2KeyFromUrl(`${R2_PUBLIC_BASE}/loja/logo%201.jpg`)).toBe("loja/logo 1.jpg");
    expect(r2KeyFromUrl("https://outro.com/a/b.png")).toBeNull();
  });
});

describe("put/delete", () => {
  it("grava com cache imutável e devolve a URL", async () => {
    const bucket = fakeBucket();
    const putSpy = vi.spyOn(bucket, "put");
    const url = await putR2Image(bucket, "loja/logo_1.webp", new ArrayBuffer(8), "image/webp");
    expect(url).toBe(`${R2_PUBLIC_BASE}/loja/logo_1.webp`);
    expect(putSpy).toHaveBeenCalledWith("loja/logo_1.webp", expect.anything(), {
      httpMetadata: {
        contentType: "image/webp",
        cacheControl: expect.stringContaining("immutable"),
      },
    });
  });

  it("remove a chave", async () => {
    const bucket = fakeBucket();
    bucket.store.set("loja/old.jpg", "binary");
    await deleteR2Image(bucket, "loja/old.jpg");
    expect(bucket.store.has("loja/old.jpg")).toBe(false);
  });
});
