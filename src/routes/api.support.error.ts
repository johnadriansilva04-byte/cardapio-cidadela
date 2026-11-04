import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/api/lib/rate-limit";
import { sendEmail, getInvoiceNotifyEmail } from "@/api/lib/email";
import { buildDevReport, type DevReportMeta } from "@/api/lib/dev-report";
import { saveSupportReport, markReportNotified } from "@/api/lib/support-reports";
import { getServerSupabase } from "@/api/lib/mercadopago";

/**
 * POST /api/support/error
 *
 * Reporte automático de erro do app. Quando o React error boundary ou o
 * handler global de erro captura uma exceção em produção, o cliente chama esta
 * rota; ela monta o relato e envia por e-mail para o time com o PROMPT PARA O
 * DEV já pronto (mensagem, stack, página, dispositivo).
 *
 * É o caminho que fecha o ciclo que você pediu: o erro acontece na tela do dono
 * e chega no seu e-mail como uma tarefa pronta para o agente corrigir.
 *
 * O que ela NÃO faz: ler o repositório. Nenhum processo aqui "vê o código" —
 * quem vê é o agente que você roda com o prompt do e-mail. A rota só garante
 * que o relato chegue completo, sem depender de o dono saber explicar.
 *
 * Body: { message, stack?, route?, component?, meta?, storeId?, storeName? }
 * É pública de propósito (o erro pode acontecer antes do login), então tem
 * rate-limit e trunca os campos — não é um vetor de spam ilimitado.
 * Deduplica por mensagem numa janela curta para o mesmo erro não virar 50 e-mails.
 */

interface ErrorBody {
  message?: string;
  stack?: string;
  route?: string;
  component?: string;
  storeId?: string;
  storeName?: string;
  meta?: DevReportMeta;
}

const recent = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10 * 60_000;

function isDuplicate(key: string): boolean {
  const now = Date.now();
  const last = recent.get(key);
  // Poda oportunista: o mapa não pode crescer para sempre num Worker.
  if (recent.size > 500) {
    for (const [k, t] of recent) if (now - t > DEDUPE_WINDOW_MS) recent.delete(k);
  }
  if (last && now - last < DEDUPE_WINDOW_MS) return true;
  recent.set(key, now);
  return false;
}

export const Route = createFileRoute("/api/support/error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = checkRateLimit(`error:${getClientIp(request)}`, 30, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        let body: ErrorBody = {};
        try {
          body = (await request.json()) as ErrorBody;
        } catch {
          return json({ ok: false }, 400);
        }
        const message = (body.message ?? "").trim().slice(0, 500);
        if (!message) return json({ ok: false }, 400);

        const dedupeKey = `${message.slice(0, 120)}|${body.route ?? ""}`;
        if (isDuplicate(dedupeKey)) return json({ ok: true, deduped: true }, 200);

        const to = getInvoiceNotifyEmail();

        // Quem reportou: se houver sessão, resolve o dono; senão fica anônimo
        // (o erro pode acontecer antes do login).
        let reporterId: string | undefined;
        let reporterEmail: string | undefined;
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (token) {
          const supabase = getServerSupabase();
          const { data } = supabase ? await supabase.auth.getUser(token) : { data: null };
          if (data?.user) {
            reporterId = data.user.id;
            reporterEmail = data.user.email ?? undefined;
          }
        }

        // Grava PRIMEIRO: o registro com protocolo é a fonte da verdade. O
        // e-mail é o aviso; se ele falhar, o caso continua achável.
        const saved = await saveSupportReport({
          kind: "erro",
          reporterId,
          reporterEmail,
          restaurantId: body.storeId,
          restaurantName: body.storeName,
          route: body.route,
          message,
          detail: {
            stack: body.stack ?? null,
            component: body.component ?? null,
            meta: body.meta ?? null,
          },
        });

        const report = buildDevReport({
          kind: "erro",
          protocol: saved.protocol,
          storeId: body.storeId,
          storeName: body.storeName,
          meta: body.meta,
          error: {
            message,
            stack: (body.stack ?? "").slice(0, 4000) || undefined,
            route: (body.route ?? "").slice(0, 300) || undefined,
            component: (body.component ?? "").slice(0, 200) || undefined,
          },
        });

        if (!to) return json({ ok: true, protocol: saved.protocol, notified: false }, 200);

        const result = await sendEmail({
          to,
          subject: report.subject,
          html: report.html,
          text: report.text,
        });
        if (result.ok) await markReportNotified(saved.id);
        return json({ ok: true, protocol: saved.protocol, notified: Boolean(result.ok) }, 200);
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
