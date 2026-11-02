import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getServerSupabase, getSupabaseForUser } from "@/api/lib/mercadopago";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/api/lib/rate-limit";
import { buildInvoiceEmail, sendEmail } from "@/api/lib/email";
import { validateInvoiceRequest, type InvoicePersonType } from "@/lib/invoice";

/**
 * POST /api/invoice/request
 *
 * Registra o pedido de nota fiscal e avisa o fornecedor por e-mail.
 *
 * Por que uma rota de servidor em vez de inserir direto pelo cliente: o e-mail
 * precisa de uma chave server-only, e o cliente não pode ser a única barreira.
 * A posse do restaurante é confirmada com o RLS do próprio usuário (como no
 * day-pass), os dados são revalidados aqui, e o registro é gravado com o
 * service role — que é quem escreve a fila e dispara o aviso.
 *
 * Body: { storeId, kind, referenceId?, quantity?, personType, taxId, legalName,
 *         email, address?, notes? }
 * Requer Authorization: Bearer <access_token>.
 */

const KINDS = new Set(["annual", "monthly", "day_pass"]);

export const Route = createFileRoute("/api/invoice/request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Pedido de nota é raro (uma vez por compra): poucas por minuto bastam.
        const rl = checkRateLimit(`invoice:${getClientIp(request)}`, 5, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) return json({ error: "não autenticado" }, 401);

        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "corpo inválido" }, 400);
        }

        const storeId = typeof body.storeId === "string" ? body.storeId : "";
        const kind = typeof body.kind === "string" ? body.kind : "";
        if (!storeId) return json({ error: "storeId não fornecido" }, 400);
        if (!KINDS.has(kind)) return json({ error: "tipo de compra inválido" }, 400);

        const personType: InvoicePersonType = body.personType === "cnpj" ? "cnpj" : "cpf";
        const taxId = String(body.taxId ?? "").replace(/\D/g, "");
        const legalName = String(body.legalName ?? "").trim();
        const email = String(body.email ?? "").trim();
        const address = body.address ? String(body.address).trim() : "";
        const notes = body.notes ? String(body.notes).trim() : "";
        const quantity = Math.max(1, Math.min(Math.floor(Number(body.quantity ?? 1) || 1), 60));
        const referenceId =
          typeof body.referenceId === "string" && body.referenceId.trim()
            ? body.referenceId.trim().slice(0, 200)
            : null;

        // Revalida no servidor: o cliente já valida, mas não é a barreira.
        const invalid = validateInvoiceRequest({
          personType,
          taxId,
          legalName,
          email,
          address,
          notes,
        });
        if (invalid) return json({ error: invalid }, 400);

        // Identidade + posse do restaurante, com o RLS do próprio usuário.
        const userClient = getSupabaseForUser(token);
        if (!userClient) return json({ error: "supabase não configurado" }, 500);
        const { data: authData, error: authError } = await userClient.auth.getUser();
        if (authError || !authData?.user) return json({ error: "token inválido" }, 401);
        const { data: owned } = await userClient
          .from("restaurants")
          .select("id, name")
          .eq("id", storeId)
          .maybeSingle();
        if (!owned) {
          return json({ error: "restaurante não encontrado para esta conta" }, 403);
        }

        const supabase = getServerSupabase();
        if (!supabase) return json({ error: "supabase não configurado" }, 500);

        const { data: inserted, error: insertError } = await supabase
          .from("invoice_requests")
          .insert({
            restaurant_id: storeId,
            requested_by: authData.user.id,
            kind,
            reference_id: referenceId,
            quantity,
            person_type: personType,
            tax_id: taxId,
            legal_name: legalName,
            email,
            address: address || null,
            notes: notes || null,
          })
          .select()
          .single();

        if (insertError) {
          // Índice único do pendente: a mesma compra já foi pedida.
          if (insertError.code === "23505") {
            return json({ error: "Já existe um pedido de nota para esta compra." }, 409);
          }
          if (insertError.code === "42P01") {
            return json({ error: "Recurso de nota indisponível no momento." }, 503);
          }
          console.error("[invoice] insert falhou:", insertError.message);
          return json({ error: "Não foi possível registrar o pedido de nota." }, 500);
        }

        // O pedido JÁ está gravado. O e-mail é aviso: se falhar, não desfaz o
        // registro (a fila no banco é a fonte da verdade) — só sinaliza.
        const message = buildInvoiceEmail({
          id: inserted.id,
          restaurantName: (owned.name as string) || "Loja",
          kind,
          quantity,
          amountCents: inserted.amount_cents ?? null,
          personType,
          taxId,
          legalName,
          email,
          address: address || null,
          notes: notes || null,
          createdAt: inserted.created_at,
        });
        const sent = await sendEmail(message);

        return json(
          {
            request: inserted,
            // A UI usa isto para dizer "emitiremos e enviamos" vs. "registrado,
            // mas o aviso por e-mail não saiu" — sem esconder a falha.
            notified: sent.ok,
            notifySkipped: sent.skipped ?? false,
          },
          201,
        );
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
