import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getServerSupabase, getSupabaseForUser } from "@/api/lib/mercadopago";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/api/lib/rate-limit";
import { scanMenuImage } from "@/api/lib/menu-extract";

/**
 * POST /api/menu/scan
 *
 * Recebe a FOTO do cardápio (data URL base64) e devolve categorias + produtos
 * sugeridos pela IA de visão. É o recurso mais caro do app (token de imagem),
 * então:
 *  - exige login (não fica aberto para anônimo consumir a cota);
 *  - exige o CICLO ANUAL vigente, verificado AQUI pelo RPC `store_access_state`
 *    com o RLS do próprio usuário — o cliente não decide isso;
 *  - limite de requisições por IP.
 *
 * NUNCA grava no banco: só devolve a sugestão. Quem cria as categorias/produtos
 * é o fluxo normal do cardápio, depois que o dono confere.
 *
 * Body: { storeId: string, image: string }  (image = "data:image/webp;base64,...")
 */

const MAX_IMAGE_CHARS = 6_000_000; // ~4,5 MB de imagem em base64

export const Route = createFileRoute("/api/menu/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = checkRateLimit(`menu-scan:${getClientIp(request)}`, 8, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) return json({ error: "não autenticado" }, 401);

        let body: { storeId?: string; image?: string } = {};
        try {
          body = (await request.json()) as { storeId?: string; image?: string };
        } catch {
          return json({ error: "invalid body" }, 400);
        }
        const storeId = (body.storeId ?? "").trim();
        const image = (body.image ?? "").trim();
        if (!storeId) return json({ error: "storeId não fornecido" }, 400);
        if (!image.startsWith("data:image/")) return json({ error: "imagem inválida" }, 400);
        if (image.length > MAX_IMAGE_CHARS) return json({ error: "imagem muito grande" }, 413);

        // Confirma a identidade e a posse do restaurante com o RLS do usuário.
        const userClient = getSupabaseForUser(token);
        if (!userClient) return json({ error: "supabase não configurado" }, 500);
        const { data: authData, error: authError } = await userClient.auth.getUser();
        if (authError || !authData?.user) return json({ error: "token inválido" }, 401);
        const { data: owned } = await userClient
          .from("restaurants")
          .select("id")
          .eq("id", storeId)
          .maybeSingle();
        if (!owned) return json({ error: "restaurante não encontrado para esta conta" }, 403);

        // GATE DO PLANO: só o ciclo anual libera a leitura por foto. A RPC roda
        // com o RLS do usuário e é a mesma fonte do selo de plano.
        const { data: access } = await userClient.rpc("store_access_state", { p_store: storeId });
        const state = (access ?? {}) as { unlocked?: boolean; premium_cycle?: string | null };
        const annual = Boolean(state.unlocked) && state.premium_cycle === "annual";
        if (!annual) {
          return json({ error: "annual_required" }, 402);
        }

        const supabase = getServerSupabase();
        if (!supabase) return json({ error: "supabase não configurado" }, 500);

        const categories = await scanMenuImage(image);
        if (!categories) {
          return json({ error: "scan_failed" }, 502);
        }
        return json({ categories }, 200);
      },
    },
  },
});

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
