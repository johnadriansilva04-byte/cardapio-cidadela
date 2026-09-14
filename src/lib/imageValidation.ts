/**
 * Validação de URL de imagem.
 * Facebook page URLs NÃO são imagens — são páginas HTML.
 */
const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"];

export function isFacebookPageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    const isFb = h.includes("facebook.com") || h.includes("fb.com") || h.includes("fbcdn.net");
    if (!isFb) return false;
    // fbcdn direct image is ok if it looks like an image
    if (h.includes("fbcdn.net") && ALLOWED_EXT.some((e) => u.pathname.toLowerCase().endsWith(e))) return false;
    // facebook.com/photo, /share, /p/... são páginas, não imagens
    if (u.pathname.includes("/share/") || u.pathname.includes("/photo") || /^\/p\//.test(u.pathname)) return true;
    // generic fb page without image ext => suspect
    const ext = ALLOWED_EXT.some((e) => u.pathname.toLowerCase().endsWith(e));
    const hasImageParam = u.searchParams.toString().toLowerCase().includes(".jpg") || u.searchParams.toString().toLowerCase().includes(".png");
    return !ext && !hasImageParam;
  } catch {
    return false;
  }
}

export function validateImageUrl(url: string): string | null {
  if (!url) return null; // empty is allowed (means no image)
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (isFacebookPageUrl(trimmed)) {
    return "URL do Facebook não é imagem. Abra a foto, clique com botão direito → \"Copiar endereço da imagem\" (termina em .jpg/.png) ou use o upload.";
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "Use URL começando com https://";
    // Heuristic: warn if it doesn't look like a direct image, but don't block (could be signed url)
    const lower = (u.pathname + u.search).toLowerCase();
    const hasExt = ALLOWED_EXT.some((e) => lower.includes(e));
    const isDataUrl = trimmed.startsWith("data:image/");
    const isSupabaseStorage = u.hostname.includes("supabase.co") && lower.includes("/storage/");
    if (!hasExt && !isDataUrl && !isSupabaseStorage) {
      return "Essa URL não parece ser de imagem direta. Prefira URL terminando em .jpg, .jpeg, .png ou .webp, ou faça upload do arquivo.";
    }
    return null;
  } catch {
    return "URL inválida. Cole uma URL direta da imagem (https://...).";
  }
}

export function isDirectImageUrl(url: string): boolean {
  return validateImageUrl(url) === null;
}
