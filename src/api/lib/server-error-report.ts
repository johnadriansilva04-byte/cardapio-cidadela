import { describeError } from "@/lib/error-capture";
import { sendEmail, getInvoiceNotifyEmail } from "@/api/lib/email";
import { buildDevReport } from "@/api/lib/dev-report";

/**
 * Reporte de erro do lado SERVIDOR (SSR e rotas de API).
 *
 * O reporter do cliente cobre o que quebra na tela do dono. Este cobre o que
 * quebra no Worker antes da resposta sair — render de SSR, rota de API, webhook.
 * Juntos, "tudo que der no código" chega por e-mail com o prompt pronto para o
 * dev, sem depender de o dono perceber e reclamar.
 *
 * Regras de segurança operacional:
 *  - best-effort: qualquer falha aqui é engolida; reportar erro não pode virar
 *    um segundo erro;
 *  - dedupe por mensagem numa janela curta (por isolate — é melhor-esforço, como
 *    o rate-limit): um erro em loop não vira 500 e-mails;
 *  - só em produção (`NODE_ENV`), para o dev local não disparar e-mail.
 */

const recent = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10 * 60_000;

function isProduction(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}

function isDuplicate(key: string): boolean {
  const now = Date.now();
  if (recent.size > 500) {
    for (const [k, t] of recent) if (now - t > DEDUPE_WINDOW_MS) recent.delete(k);
  }
  const last = recent.get(key);
  if (last && now - last < DEDUPE_WINDOW_MS) return true;
  recent.set(key, now);
  return false;
}

export async function reportServerError(
  error: unknown,
  context: { url?: string; method?: string } = {},
): Promise<void> {
  if (!isProduction()) return;
  try {
    const message = describeError(error).split("\n")[0]?.slice(0, 500) || "erro no servidor";
    const key = `${context.method ?? "?"} ${context.url ?? ""} ${message.slice(0, 100)}`;
    if (isDuplicate(key)) return;

    const to = getInvoiceNotifyEmail();
    if (!to) return;

    const report = buildDevReport({
      kind: "erro",
      meta: { url: `${context.method ?? "GET"} ${context.url ?? "desconhecida"}` },
      error: {
        message,
        stack: describeError(error).slice(0, 4000),
        route: context.url,
        component: "server",
      },
    });

    await sendEmail({
      to,
      subject: report.subject,
      html: report.html,
      text: report.text,
    });
  } catch (err) {
    console.error("[server-error-report] falhou:", err);
  }
}
