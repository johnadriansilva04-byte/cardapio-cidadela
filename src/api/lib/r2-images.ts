/**
 * Imagens de restaurante no Cloudflare R2 (server-only).
 *
 * Por que R2 e não Supabase Storage: o plano gratuito do Supabase dá 5 GB de
 * egress/mês, e imagem é o que mais sai. No R2 o egress é **zero** e o domínio
 * público (`images.pracinha.online`) é proxied pela Cloudflare, que cacheia a
 * imagem na borda (MISS → HIT) — a foto é servida do cache, sem tocar o R2 e
 * sem gastar a cota do Supabase. É o que estica o grátis de ~20 para centenas
 * de lojas.
 *
 * O binding `IMAGES` é acessado pelo runtime do Pages
 * (`request.runtime.cloudflare.env.IMAGES`). Sem ele (dev local, deploy antigo)
 * as rotas devolvem 503 e o cliente cai no Supabase Storage — nada quebra.
 */

/** Subconjunto da API do binding R2 que usamos. */
export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | Blob | string,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
    },
  ): Promise<unknown>;
  get(key: string): Promise<{ body?: ReadableStream | null } | null>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    objects: { key: string; size?: number; uploaded?: Date }[];
    truncated: boolean;
    cursor?: string;
  }>;
}

/** Base pública do bucket. Proxied pela Cloudflare → cache de borda. */
export const R2_PUBLIC_BASE = "https://images.pracinha.online";

/** Prefixo do bucket de imagens no R2. */
export const R2_IMAGES_BUCKET = "cardapio-cidadela-images";

/** Nome do binding configurado no projeto Pages. */
export const R2_BINDING = "IMAGES";

/** Um ano: o nome do arquivo tem timestamp, então a URL é imutável. */
const CACHE_CONTROL = "public, max-age=31536000, immutable";

type RequestWithRuntime = Request & {
  runtime?: { cloudflare?: { env?: Record<string, unknown> } };
};

/**
 * Extrai o binding R2 do request. Devolve `null` quando não existe (dev local
 * ou projeto Pages sem o binding) — quem chama decide degradar.
 */
export function getImagesBinding(request: Request): R2BucketLike | null {
  const env = (request as RequestWithRuntime).runtime?.cloudflare?.env;
  const bucket = env?.[R2_BINDING];
  if (!bucket || typeof bucket !== "object") return null;
  const b = bucket as Partial<R2BucketLike>;
  if (typeof b.put !== "function" || typeof b.delete !== "function") return null;
  return bucket as R2BucketLike;
}

/** URL pública de um objeto. */
export function r2PublicUrl(key: string): string {
  return `${R2_PUBLIC_BASE}/${key}`;
}

/** `true` quando a URL aponta para o domínio público do R2. */
export function isR2Url(url: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname === new URL(R2_PUBLIC_BASE).hostname;
  } catch {
    return false;
  }
}

/**
 * Recupera a chave do objeto a partir da URL pública. Devolve `null` se a URL
 * não for do R2 — assim o DELETE ignora URL do Supabase (caminho legado).
 */
export function r2KeyFromUrl(url: string): string | null {
  if (!isR2Url(url)) return null;
  try {
    const parsed = new URL(url);
    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    return key || null;
  } catch {
    return null;
  }
}

/** Grava a imagem no R2 e devolve a URL pública. */
export async function putR2Image(
  bucket: R2BucketLike,
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<string> {
  await bucket.put(key, body, {
    httpMetadata: { contentType, cacheControl: CACHE_CONTROL },
  });
  return r2PublicUrl(key);
}

/** Remove a imagem do R2. Não falha se a chave não existir. */
export async function deleteR2Image(bucket: R2BucketLike, key: string): Promise<void> {
  await bucket.delete(key);
}
