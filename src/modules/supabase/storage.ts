import { supabase } from "./client";
import { getCurrentSession } from "./auth";
import { compressImageForUpload } from "@/lib/imageCompression";
import { R2_PUBLIC_BASE } from "@/api/lib/r2-images";

const BUCKET = "restaurant-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

function extFromFile(file: File): string {
  const raw = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (ALLOWED_EXT.has(raw)) return raw === "jpeg" ? "jpg" : raw;
  // fallback por mime
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

/**
 * Sobe a imagem para o R2 via `/api/image/upload`. Devolve `unavailable: true`
 * quando a rota não existe (sem binding R2, dev local ou deploy antigo) — quem
 * chama cai no Supabase Storage.
 */
async function uploadToR2(
  restaurantId: string,
  file: File,
  kind: "logo" | "banner" | "product",
): Promise<{ url: string | null; error?: string; unavailable?: boolean }> {
  const session = await getCurrentSession();
  const token = session?.access_token;
  if (!token) return { url: null, unavailable: true };

  const form = new FormData();
  form.append("file", file);
  form.append("restaurantId", restaurantId);
  form.append("kind", kind);

  try {
    const res = await fetch("/api/image/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (res.status === 503) return { url: null, unavailable: true };
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok) return { url: null, error: data.error || "Falha no upload. Tente novamente." };
    if (!data.url) return { url: null, unavailable: true };
    return { url: data.url };
  } catch {
    // Rota ausente/rede: não é erro fatal, tenta o caminho antigo.
    return { url: null, unavailable: true };
  }
}

/** Grava no Supabase Storage (fallback quando o R2 não está disponível). */
async function uploadToSupabase(
  restaurantId: string,
  optimized: File,
): Promise<{ url: string | null; error?: string }> {
  const ext = extFromFile(optimized);
  const path = `${restaurantId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, optimized, {
    contentType: optimized.type,
    upsert: false,
    cacheControl: "31536000",
  });

  if (error) {
    const msg = error.message ?? "";
    if (/row-level security|row level security|violates row level security/i.test(msg)) {
      return {
        url: null,
        error:
          "Sem permissão para enviar. Verifique se você está logado como dono deste restaurante e se o SQL do Storage foi executado (supabase/schema.sql).",
      };
    }
    if (/bucket.*not found|No such bucket/i.test(msg)) {
      return {
        url: null,
        error:
          "Bucket restaurant-images não encontrado. Execute o supabase/schema.sql no SQL Editor do Supabase.",
      };
    }
    return { url: null, error: msg || "Falha no upload. Tente novamente." };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

/**
 * Upload autenticado de imagem de restaurante.
 * - Aceita só JPG/JPEG/PNG/WebP e até 5 MB
 * - Comprime no navegador para WebP ≤ 800x800 (qualidade 70%) antes de enviar,
 *   então nenhum bucket guarda uma foto pesada
 * - Destino preferido: **Cloudflare R2** (`/api/image/upload`, egress zero e
 *   cache de borda). Sem a rota, cai no Supabase Storage (bucket
 *   `restaurant-images`, RLS: só o dono escreve; leitura pública).
 * - Caminho no bucket: `<restaurantId>/<kind>_<timestamp>_<rand>.<ext>`
 */
export async function uploadRestaurantImage(
  restaurantId: string,
  file: File,
  kind: "logo" | "banner" | "product",
): Promise<{ url: string | null; error?: string }> {
  if (!ALLOWED_MIME.has(file.type)) {
    return { url: null, error: "Formato não permitido. Use JPG, PNG ou WebP." };
  }
  if (file.size > MAX_BYTES) {
    return { url: null, error: "Arquivo muito grande (máx. 5 MB)." };
  }
  if (!restaurantId || restaurantId === "new") {
    return { url: null, error: "Salve o restaurante primeiro antes de enviar a imagem." };
  }

  const { file: optimized, compressed } = await compressImageForUpload(file);
  if (compressed && !ALLOWED_MIME.has(optimized.type)) {
    return { url: null, error: "Falha ao processar a imagem. Tente outro arquivo." };
  }

  const r2 = await uploadToR2(restaurantId, optimized, kind);
  if (r2.url) return { url: r2.url };
  // Erro de verdade (formato/tamanho) veio da rota: não tenta o legado.
  if (r2.error) return { url: null, error: r2.error };

  return uploadToSupabase(restaurantId, optimized);
}

/**
 * Remove uma imagem antiga a partir da URL pública — no R2
 * (`/api/image/delete`) ou no Supabase Storage. Não falha a operação principal
 * se não conseguir: é só limpeza.
 */
export async function deleteRestaurantImageByUrl(
  publicUrl: string,
  restaurantId?: string,
): Promise<void> {
  // R2: só quando a URL é do domínio público e sabemos a loja (escopo do delete).
  if (restaurantId && publicUrl.startsWith(R2_PUBLIC_BASE)) {
    try {
      const session = await getCurrentSession();
      const token = session?.access_token;
      if (token) {
        const res = await fetch("/api/image/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ restaurantId, url: publicUrl }),
        });
        if (res.ok || res.status === 503) return;
      }
    } catch {
      // cai no caminho do Supabase (no-op se a chave não for de lá)
    }
  }

  try {
    const url = new URL(publicUrl);
    // path após /storage/v1/object/public/restaurant-images/
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return;
    const path = decodeURIComponent(url.pathname.slice(idx + marker.length));
    if (!path) return;
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // ignora
  }
}
