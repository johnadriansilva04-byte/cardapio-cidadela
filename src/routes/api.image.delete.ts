import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getSupabaseForUser } from "@/api/lib/mercadopago";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/api/lib/rate-limit";
import { deleteR2Image, getImagesBinding, r2KeyFromUrl } from "@/api/lib/r2-images";

/**
 * POST /api/image/delete
 *
 * Remove do R2 a imagem antiga quando o dono troca logo/banner/produto. Sem
 * isso os arquivos antigos ficariam no bucket para sempre ocupando espaço.
 *
 * Body: { restaurantId, url }
 * Requer Authorization: Bearer <access_token> e posse do restaurante. Só apaga
 * chaves sob o prefixo do próprio restaurante — uma URL do R2 de terceiros é
 * recusada, mesmo que o usuário seja dono de outra loja.
 *
 * Devolve 503 (`r2_unavailable`) sem o binding; o cliente simplesmente ignora.
 */

export const Route = createFileRoute("/api/image/delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = checkRateLimit(`image-delete:${getClientIp(request)}`, 60, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        const bucket = getImagesBinding(request);
        if (!bucket) return json({ error: "r2_unavailable" }, 503);

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) return json({ error: "não autenticado" }, 401);

        let body: { restaurantId?: string; url?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "invalid body" }, 400);
        }
        const restaurantId = String(body.restaurantId ?? "");
        const url = String(body.url ?? "");
        if (!restaurantId || !url) return json({ error: "restaurantId e url obrigatórios" }, 400);

        const key = r2KeyFromUrl(url);
        if (!key) return json({ error: "url não é do R2" }, 400);
        // Só o prefixo da própria loja: impede apagar imagem de outra conta.
        if (!key.startsWith(`${restaurantId}/`))
          return json({ error: "fora do escopo da loja" }, 403);

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

        try {
          await deleteR2Image(bucket, key);
          return json({ ok: true }, 200);
        } catch (e) {
          return json({ error: `falha ao remover: ${String(e)}` }, 500);
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
