import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getSupabaseForUser } from "@/api/lib/mercadopago";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/api/lib/rate-limit";
import { isValidProtocol, normalizeProtocol } from "@/api/lib/protocol";

/**
 * GET /api/support/report?protocol=CID-AAAAMMDD-XXXXXX
 *
 * Busca um relato pelo protocolo de atendimento. É o "achar" que faltava: o
 * dono guarda o protocolo e consegue recuperar o caso e o estado dele.
 *
 * Requer Authorization: Bearer <access_token>. A busca roda COM a identidade do
 * usuário (RLS de `support_reports`), então ele só enxerga relato da própria
 * loja ou que ele mesmo abriu — a rota não devolve nada de terceiros.
 *
 * Não expõe o `detail` cru (pode conter dado do cliente): devolve só o resumo.
 */

export const Route = createFileRoute("/api/support/report")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const rl = checkRateLimit(`report:${getClientIp(request)}`, 30, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) return json({ error: "não autenticado" }, 401);

        const protocolRaw = new URL(request.url).searchParams.get("protocol") ?? "";
        if (!isValidProtocol(protocolRaw)) return json({ error: "protocolo inválido" }, 400);
        const protocol = normalizeProtocol(protocolRaw);

        const supabase = getSupabaseForUser(token);
        if (!supabase) return json({ error: "supabase não configurado" }, 500);

        const { data, error } = await supabase
          .from("support_reports")
          .select("protocol, kind, status, restaurant_name, message, email_sent, created_at, updated_at")
          .eq("protocol", protocol)
          .maybeSingle();

        if (error) {
          console.error("[support] busca falhou:", error.message);
          return json({ error: "não foi possível buscar" }, 500);
        }
        if (!data) return json({ found: false }, 404);

        return json({ found: true, report: data }, 200);
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
