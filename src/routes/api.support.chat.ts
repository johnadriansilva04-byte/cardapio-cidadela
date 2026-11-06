import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getServerSupabase } from "@/api/lib/mercadopago";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/api/lib/rate-limit";
import { runAi, isAiEnabled } from "@/api/lib/ai";
import { sendEmail, getInvoiceNotifyEmail } from "@/api/lib/email";
import { buildDevReport, type DevReportMeta } from "@/api/lib/dev-report";
import { saveSupportReport, markReportNotified, realEmail } from "@/api/lib/support-reports";
import { COMPANY } from "@/lib/company";

/**
 * POST /api/support/chat
 *
 * O Pracinha — assistente de suporte do Cardápio Cidadela (produto da Variant).
 * Nome em homenagem aos pracinhas da FEB (1944-45).
 *
 * Duas saídas:
 *  1. resposta imediata ao dono (IA quando disponível; senão um texto-guia);
 *  2. quando o caso é escalado (o dono toca "Enviar para o time" ou a IA marca
 *     `[ESCALAR]`), um relato vai por e-mail com contexto + PROMPT PARA O DEV.
 *
 * IMPORTANTE: a IA NÃO lê o repositório. Ela não "vê o código". O que ela faz é
 * capturar o relato + o contexto e transformar isso num prompt que um agente COM
 * acesso ao código (o OpenHands que você já usa) executa. É a ponte prática
 * entre "o dono viu um erro" e "alguém com o código corrige".
 *
 * Body: { messages, storeId?, storeName?, escalate?, meta? }
 * Requer Authorization: Bearer <access_token>.
 * O e-mail é best-effort: sem `RESEND_API_KEY` a resposta sai e o e-mail não.
 */

const SUPPORT_PROMPT = `Você é o Pracinha, assistente de suporte do "Cardápio Cidadela", um produto da Variant.
O nome é uma homenagem aos pracinhas da Força Expedicionária Brasileira (FEB), que lutaram na Itália em 1944-45.
Você é um colaborador da Variant: fale como alguém do time, próximo, direto e sem enrolação, em português do Brasil, no máximo 4 frases.
Você ajuda com: criar cardápio, pedidos, preços, plano Premium (R$ 28,99/mês ou R$ 199,99/ano), diária (R$ 1,99 por 24h, até 15 no mês), PIX, WhatsApp e instalar no celular.
Nunca invente telas ou funções que não existem. Nunca peça senha nem dados de cartão.
Se o problema exigir alguém olhando o código (erro, tela travada, valor errado, algo que você não consegue resolver), diga que vai passar para o time de engenharia da Variant e TERMINE a resposta com a palavra ESCALAR entre colchetes: [ESCALAR]`;

const ESCALATE_MARKER = /\[?\s*escalar\s*\]?/gi;

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const Route = createFileRoute("/api/support/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = checkRateLimit(`support:${getClientIp(request)}`, 15, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) return json({ error: "não autenticado" }, 401);

        const supabase = getServerSupabase();
        if (!supabase) return json({ error: "supabase não configurado" }, 500);
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData?.user) return json({ error: "token inválido" }, 401);
        const ownerEmail = authData.user.email ?? "";

        let body: {
          messages?: ChatTurn[];
          storeId?: string;
          storeName?: string;
          escalate?: boolean;
          meta?: DevReportMeta;
        } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "invalid body" }, 400);
        }
        const history = (body.messages ?? [])
          .filter((m) => m && typeof m.content === "string")
          .slice(-10)
          .map((m) => ({
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content.slice(0, 1000),
          }));
        if (history.length === 0) return json({ error: "sem mensagens" }, 400);

        const aiEnabled = isAiEnabled();
        const raw =
          (await runAi(
            [{ role: "system", content: SUPPORT_PROMPT }, ...history],
            undefined,
            400,
          )) ??
          (aiEnabled
            ? "Não consegui resolver isso agora. Vou passar para o time de engenharia da Variant. [ESCALAR]"
            : `Recebi sua mensagem e vou passar para o time da Variant. Você também pode escrever para ${COMPANY.supportEmail}. [ESCALAR]`);

        const aiWantsEscalation = ESCALATE_MARKER.test(raw);
        ESCALATE_MARKER.lastIndex = 0;
        const reply = raw
          .replace(ESCALATE_MARKER, "")
          .replace(/\s{2,}/g, " ")
          .trim();

        const shouldEscalate = Boolean(body.escalate) || aiWantsEscalation;

        // O e-mail só sai quando o caso é escalado — mandar a cada mensagem
        // gastaria a cota do Resend (3.000/mês) com conversa fiada.
        let notified = false;
        let protocol: string | undefined;
        if (shouldEscalate) {
          const to = getInvoiceNotifyEmail();
          const lastUser = [...history].reverse().find((m) => m.role === "user");
          // Grava primeiro (fonte da verdade), avisa depois (best-effort).
          const saved = await saveSupportReport({
            kind: "suporte",
            reporterId: authData.user.id,
            reporterEmail: ownerEmail,
            restaurantId: body.storeId,
            restaurantName: body.storeName,
            route: body.meta?.url,
            message: lastUser?.content?.slice(0, 300),
            detail: { turns: history, meta: body.meta ?? null },
          });
          protocol = saved.protocol;

          if (to) {
            const report = buildDevReport({
              kind: "suporte",
              protocol: saved.protocol,
              ownerEmail: realEmail(ownerEmail),
              storeId: body.storeId,
              storeName: body.storeName,
              meta: body.meta,
              turns: history,
            });
            const result = await sendEmail({
              to,
              subject: report.subject,
              html: report.html,
              text: report.text,
            });
            notified = Boolean(result.ok);
            if (notified) await markReportNotified(saved.id);
          }
        }

        return json({ reply, escalated: shouldEscalate, notified, protocol }, 200);
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
