import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getServerSupabase } from "@/api/lib/mercadopago";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/api/lib/rate-limit";
import { runAi, isAiEnabled } from "@/api/lib/ai";
import { sendEmail, getInvoiceNotifyEmail } from "@/api/lib/email";
import { COMPANY } from "@/lib/company";

/**
 * POST /api/support/chat
 *
 * Chat de suporte. Duas saídas, sempre:
 *  1. resposta imediata ao dono (IA quando disponível; senão um texto-guia
 *     apontando o canal de e-mail);
 *  2. o relato encaminhado por e-mail para você (`INVOICE_NOTIFY_EMAIL`), com a
 *     loja, o e-mail do dono e a conversa — para nada ficar só na tela.
 *
 * Body: { messages: [{ role, content }], storeId?: string }
 * Requer Authorization: Bearer <access_token>.
 *
 * O e-mail é best-effort: sem `RESEND_API_KEY` o registro não sai, mas a
 * resposta ao dono continua. Nunca lança — o chat não pode quebrar a tela.
 */

const SUPPORT_PROMPT = `Você é o suporte do "Cardápio Cidadela", um sistema de cardápio digital e pedidos para restaurantes.
Fale em português do Brasil, direto e curto (no máximo 4 frases). Ajuda com: criar cardápio, pedidos, preços, plano Premium (R$ 28,99/mês ou R$ 199,99/ano), diária (R$ 1,99 por 24h, até 15 no mês), PIX, WhatsApp, instalar no celular.
Se não souber resolver, diga que vai encaminhar para o time e peça o e-mail de contato.
Nunca invente telas ou funções que não existem. Nunca peça senha nem dados de cartão.`;

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

        let body: { messages?: ChatTurn[]; storeId?: string } = {};
        try {
          body = (await request.json()) as { messages?: ChatTurn[]; storeId?: string };
        } catch {
          return json({ error: "invalid body" }, 400);
        }
        const history = (body.messages ?? [])
          .filter((m) => m && typeof m.content === "string")
          .slice(-8)
          .map((m) => ({
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content.slice(0, 1000),
          }));
        if (history.length === 0) return json({ error: "sem mensagens" }, 400);

        const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

        const aiEnabled = isAiEnabled();
        const reply =
          (await runAi(
            [{ role: "system", content: SUPPORT_PROMPT }, ...history],
            undefined,
            400,
          )) ??
          (aiEnabled
            ? "Não consegui responder agora. Vou encaminhar seu relato para o time — se quiser, responda com seu e-mail de contato."
            : `Recebi sua mensagem e vou encaminhar para o time. Você também pode escrever direto para ${COMPANY.supportEmail}.`);

        // Encaminha o relato por e-mail (best-effort, não bloqueia a resposta).
        let notified = false;
        const to = getInvoiceNotifyEmail();
        if (to) {
          const result = await sendEmail({
            to,
            subject: `[Suporte] ${lastUser.slice(0, 60)}`,
            html: buildSupportEmail(ownerEmail, body.storeId, history),
            text: `De: ${ownerEmail}\nLoja: ${body.storeId ?? "-"}\n\n${history
              .map((m) => `${m.role}: ${m.content}`)
              .join("\n")}`,
          });
          notified = Boolean(result.ok);
        }

        return json({ reply, notified }, 200);
      },
    },
  },
});

function buildSupportEmail(
  ownerEmail: string,
  storeId: string | undefined,
  turns: ChatTurn[],
): string {
  const rows = turns
    .map(
      (t) =>
        `<p style="margin:6px 0"><b>${t.role === "user" ? "Dono" : "Suporte"}:</b> ${escapeHtml(
          t.content,
        )}</p>`,
    )
    .join("");
  return `<div style="font-family:sans-serif;font-size:14px;color:#111">
    <h2 style="margin:0 0 8px">Relato de suporte</h2>
    <p style="margin:2px 0"><b>Conta:</b> ${escapeHtml(ownerEmail || "desconhecida")}</p>
    <p style="margin:2px 0"><b>Loja:</b> ${escapeHtml(storeId ?? "não informada")}</p>
    <hr style="border:none;border-top:1px solid #ddd;margin:12px 0"/>
    ${rows}
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
