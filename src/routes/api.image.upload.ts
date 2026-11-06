import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getSupabaseForUser } from "@/api/lib/mercadopago";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/api/lib/rate-limit";
import { getImagesBinding, putR2Image } from "@/api/lib/r2-images";

/**
 * POST /api/image/upload
 *
 * Recebe logo/banner/produto e grava no Cloudflare R2 (egress zero). É o
 * substituto do upload direto no Supabase Storage, que consumia a cota de
 * 5 GB/mês de egress com imagem — o maior gasto do plano gratuito.
 *
 * Body: multipart/form-data com `file`, `restaurantId` e `kind`.
 * Requer Authorization: Bearer <access_token> e que o restaurante pertença ao
 * usuário (RLS do próprio token) — senão qualquer um escreveria na conta.
 *
 * Devolve 503 (`r2_unavailable`) quando o binding não existe; o cliente cai no
 * caminho antigo (Supabase Storage) e nada quebra.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const KINDS = new Set(["logo", "banner", "product"]);

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export const Route = createFileRoute("/api/image/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = checkRateLimit(`image-upload:${getClientIp(request)}`, 30, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        const bucket = getImagesBinding(request);
        if (!bucket) return json({ error: "r2_unavailable" }, 503);

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) return json({ error: "não autenticado" }, 401);

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "invalid body" }, 400);
        }

        const file = form.get("file");
        const restaurantId = String(form.get("restaurantId") ?? "");
        const kind = String(form.get("kind") ?? "");
        if (!(file instanceof File)) return json({ error: "arquivo ausente" }, 400);
        if (!restaurantId) return json({ error: "restaurantId ausente" }, 400);
        if (!KINDS.has(kind)) return json({ error: "kind inválido" }, 400);
        if (!ALLOWED_MIME.has(file.type)) {
          return json({ error: "Formato não permitido. Use JPG, PNG ou WebP." }, 415);
        }
        if (file.size > MAX_BYTES) return json({ error: "Arquivo muito grande (máx. 5 MB)." }, 413);

        // Confirma identidade + posse do restaurante com o RLS do usuário.
        const userClient = getSupabaseForUser(token);
        if (!userClient) return json({ error: "supabase não configurado" }, 500);
        const { data: authData, error: authError } = await userClient.auth.getUser();
        if (authError || !authData?.user) return json({ error: "token inválido" }, 401);
        const { data: owned } = await userClient
          .from("restaurants")
          .select("id")
          .eq("id", restaurantId)
          .maybeSingle();
        if (!owned) return json({ error: "restaurante não encontrado para esta conta" }, 403);

        const ext = extFor(file.type);
        const key = `${restaurantId}/${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const body = await file.arrayBuffer();
        try {
          const url = await putR2Image(bucket, key, body, file.type);
          return json({ url }, 200);
        } catch (e) {
          return json({ error: `falha no upload: ${String(e)}` }, 500);
        }
      },
    },
  },
});

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
