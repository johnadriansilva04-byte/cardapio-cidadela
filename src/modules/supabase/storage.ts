import { supabase } from "./client";

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
 * Upload autenticado para Supabase Storage (bucket `restaurant-images`).
 * - Aceita só JPG/JPEG/PNG/WebP e até 5 MB
 * - Caminho: <restaurantId>/<kind>_<timestamp>_<rand>.<ext>
 * - Políticas RLS: só dono do restaurante (owner_id = auth.uid()) pode inserir/atualizar/excluir
 * - Leitura pública
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

  const ext = extFromFile(file);
  const path = `${restaurantId}/${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600",
  });

  if (error) {
    const msg = error.message ?? "";
    if (/row-level security|row level security|violates row-level security/i.test(msg)) {
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
 * Tenta remover um arquivo do Storage a partir da URL pública.
 * Não falha a operação principal se não conseguir.
 */
export async function deleteRestaurantImageByUrl(publicUrl: string): Promise<void> {
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
