import { supabase } from "./client";

/**
 * Faz upload de imagem para Supabase Storage (bucket `public` ou `images`).
 * Se nenhum bucket público existir, faz fallback para URL temporária (blob).
 *
 * Tenta nesta ordem de bucket: restaurant-images → images → public
 * — se tudo falhar, retorna null (o caller deve usar URL externa então).
 */
const CANDIDATE_BUCKETS = ["restaurant-images", "images", "public"];

export async function uploadRestaurantImage(
  restaurantId: string,
  file: File,
  kind: "logo" | "banner" | "product",
): Promise<{ url: string | null; error?: string }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "avif", "gif"].includes(ext) ? ext : "jpg";
  const path = `${restaurantId}/${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  for (const bucket of CANDIDATE_BUCKETS) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || `image/${safeExt}`,
      upsert: false,
    });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return { url: data.publicUrl };
    }
    // NoSuchBucket / not found — tenta próximo
    const msg = (error as { message?: string })?.message ?? "";
    const isMissingBucket = /bucket.*not found|No such bucket/i.test(msg);
    if (!isMissingBucket) {
      // outro erro real — retorna
      return { url: null, error: msg || "Falha no upload." };
    }
  }
  return {
    url: null,
    error: "Nenhum bucket de Storage público encontrado. Crie um bucket público (ex: restaurant-images) no Supabase → Storage, ou use URL direta.",
  };
}
