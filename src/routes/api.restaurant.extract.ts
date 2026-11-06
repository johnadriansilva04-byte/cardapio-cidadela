import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getServerSupabase } from "@/api/lib/mercadopago";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/api/lib/rate-limit";
import { extractRestaurantFields } from "@/api/lib/restaurant-extract";

/**
 * POST /api/restaurant/extract
 *
 * Recebe o texto livre do dono ("Meu restaurante é a Cantina da Pracinha, fica
 * na Rua X, WhatsApp 48 99999-9999, entrega R$ 5") e devolve os campos do
 * formulário já preenchidos.
 *
 * Body: { text: string }
 * Requer Authorization: Bearer <access_token> (endpoint com custo de IA: não
 * pode ficar aberto para anônimo consumir a cota).
 *
 * NUNCA grava nada: só sugere valores. Quem salva é o fluxo normal de criação,
 * depois que o dono confere. Se a IA estiver desligada, a rota ainda responde
 * com o que a heurística determinística achou (`ai: false`).
 */

export const Route = createFileRoute("/api/restaurant/extract")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = checkRateLimit(`extract:${getClientIp(request)}`, 20, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) return json({ error: "não autenticado" }, 401);

        const supabase = getServerSupabase();
        if (!supabase) return json({ error: "supabase não configurado" }, 500);
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData?.user) return json({ error: "token inválido" }, 401);

        let body: { text?: string } = {};
        try {
          body = (await request.json()) as { text?: string };
        } catch {
          return json({ error: "invalid body" }, 400);
        }
        const text = (body.text ?? "").trim();
        if (!text) return json({ error: "texto vazio" }, 400);

        const { fields, ai } = await extractRestaurantFields(text.slice(0, 2000));
        return json({ fields, ai }, 200);
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
