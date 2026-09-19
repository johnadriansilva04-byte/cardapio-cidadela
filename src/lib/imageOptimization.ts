// Otimização de imagens servidas pelo Supabase Storage.
//
// O Supabase aceita transformações na URL (/render/image/...?width=...&quality=...),
// mas a transformação é um recurso pago e pode estar desabilitada no projeto.
// Por isso a URL otimizada é uma *sugestão*: quem chama decide se usa, e o
// componente <SmartImage> cai para a URL original se a transformada falhar.

const SUPABASE_OBJECT_MARKER = "/storage/v1/object/public/";
const SUPABASE_RENDER_PATH = "/storage/v1/render/image/public/";

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  /** 20–100; abaixo de 60 costuma ficar visivelmente ruim em foto de comida. */
  quality?: number;
  /** `cover` recorta para preencher; `contain` preserva a imagem inteira. */
  resize?: "cover" | "contain" | "fill";
}

const MIN_QUALITY = 20;
const MAX_QUALITY = 100;

function clampQuality(quality: number | undefined): number {
  if (!quality || !Number.isFinite(quality)) return 75;
  return Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, Math.round(quality)));
}

/** Só URLs de bucket público do Supabase podem ser transformadas. */
export function isSupabaseStorageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith("supabase.co") &&
      parsed.pathname.includes(SUPABASE_OBJECT_MARKER) &&
      parsed.pathname.includes("/restaurant-images/")
    );
  } catch {
    return false;
  }
}

/**
 * Constrói a URL transformada do Supabase. Devolve a original quando não é
 * Storage do Supabase ou quando não há transformação pedida — assim o chamador
 * pode usar o resultado sem checar nada.
 */
export function optimizedImageUrl(url: string, options: ImageTransformOptions = {}): string {
  if (!url || !isSupabaseStorageUrl(url)) return url;

  const { width, height, quality, resize = "cover" } = options;
  if (!width && !height) return url;

  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(SUPABASE_OBJECT_MARKER, SUPABASE_RENDER_PATH);
    if (width) parsed.searchParams.set("width", String(Math.round(width)));
    if (height) parsed.searchParams.set("height", String(Math.round(height)));
    parsed.searchParams.set("quality", String(clampQuality(quality)));
    parsed.searchParams.set("resize", resize);
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Monta um `srcset` com 1x e 2x para telas retina. Devolve `undefined` quando
 * não faz sentido (imagem externa), evitando atributo vazio no <img>.
 */
export function imageSrcSet(
  url: string,
  width: number,
  options: ImageTransformOptions = {},
): string | undefined {
  if (!isSupabaseStorageUrl(url)) return undefined;
  const one = optimizedImageUrl(url, { ...options, width });
  const two = optimizedImageUrl(url, { ...options, width: width * 2 });
  if (one === url && two === url) return undefined;
  return `${one} 1x, ${two} 2x`;
}

/** Tamanhos comuns usados no cardápio, para não repetir números mágicos. */
export const IMAGE_SIZES = {
  /** Miniatura na lista de produtos. */
  thumb: 68,
  /** Logo do restaurante no cabeçalho. */
  logo: 160,
  /** Banner do topo. */
  banner: 1200,
  /** Foto em destaque no modal do produto. */
  hero: 640,
} as const;
