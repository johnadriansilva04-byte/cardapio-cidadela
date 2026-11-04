/**
 * Monta o relato de suporte/erro e o PROMPT PARA O DEV.
 *
 * Compartilhado entre o chat do Pracinha (`api.support.chat.ts`) e o reporte
 * automático de erros (`api.support.error.ts`), para o e-mail chegar sempre no
 * mesmo formato — e para o bloco "prompt para o dev" ter um só lugar.
 *
 * Determinístico de propósito: o prompt é montado a partir do contexto, sem
 * depender de uma segunda chamada de IA. Se a IA cair, o relato continua saindo
 * com tudo o que o dev precisa para começar.
 */

export interface DevReportMeta {
  url?: string;
  userAgent?: string;
  screen?: string;
  locale?: string;
}

export interface DevReportInput {
  kind: "suporte" | "erro";
  ownerEmail?: string;
  storeId?: string;
  storeName?: string;
  meta?: DevReportMeta;
  /** Conversa do suporte (kind = "suporte"). */
  turns?: { role: "user" | "assistant"; content: string }[];
  /** Detalhes do erro (kind = "erro"). */
  error?: {
    message: string;
    stack?: string;
    route?: string;
    component?: string;
  };
}

export interface DevReport {
  subject: string;
  html: string;
  text: string;
}

export function buildDevReport(input: DevReportInput): DevReport {
  const { kind, ownerEmail, storeId, storeName, meta, turns = [], error } = input;
  const when = new Date().toISOString();

  const contextLines = [
    `Tipo: ${kind === "erro" ? "erro no app" : "relato de suporte"}`,
    `Loja: ${storeName ?? "não informada"}${storeId ? ` (${storeId})` : ""}`,
    `Conta: ${ownerEmail || "desconhecida"}`,
    `Página: ${meta?.url ?? error?.route ?? "não informada"}`,
    `Dispositivo: ${meta?.userAgent ?? "não informado"}`,
    `Tela: ${meta?.screen ?? "-"} · Idioma: ${meta?.locale ?? "-"}`,
    `Quando: ${when}`,
  ];

  const body =
    kind === "erro" && error
      ? `ERRO CAPTURADO\nMensagem: ${error.message}\nComponente: ${error.component ?? "-"}\n\nSTACK\n${error.stack ?? "(sem stack)"}`
      : `RELATO (conversa do suporte)\n${turns
          .map((t) => `${t.role === "user" ? "Dono" : "Pracinha"}: ${t.content}`)
          .join("\n")}`;

  const devPrompt =
    kind === "erro"
      ? buildErrorPrompt(contextLines, error, body)
      : buildSupportPrompt(contextLines, body);

  const text = `${kind === "erro" ? "ERRO REPORTADO" : "RELATO DE SUPORTE"} — Pracinha (Variant)

${contextLines.map((l) => `- ${l}`).join("\n")}

${body}

===== PROMPT PARA O DEV (copie daqui para baixo) =====
${devPrompt}`;

  const rows = turns
    .map(
      (t) =>
        `<p style="margin:6px 0"><b>${t.role === "user" ? "Dono" : "Pracinha"}:</b> ${escapeHtml(
          t.content,
        )}</p>`,
    )
    .join("");

  const errorBlock =
    kind === "erro" && error
      ? `<p style="margin:6px 0"><b>Mensagem:</b> ${escapeHtml(error.message)}</p>
         <p style="margin:6px 0"><b>Componente:</b> ${escapeHtml(error.component ?? "-")}</p>
         <pre style="white-space:pre-wrap;background:#fff5f5;border:1px solid #f3c2c2;border-radius:8px;padding:10px;font-size:11px;color:#7a1d1d">${escapeHtml(
           error.stack ?? "(sem stack)",
         )}</pre>`
      : "";

  const html = `<div style="font-family:sans-serif;font-size:14px;color:#111;max-width:640px">
    <h2 style="margin:0 0 4px">${kind === "erro" ? "Erro reportado" : "Relato de suporte"} — Pracinha</h2>
    <p style="margin:0 0 12px;color:#666">Cardápio Cidadela · Variant</p>
    <ul style="margin:0 0 12px;padding-left:18px">
      ${contextLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}
    </ul>
    <hr style="border:none;border-top:1px solid #ddd;margin:12px 0"/>
    ${errorBlock}
    ${rows}
    <hr style="border:none;border-top:1px solid #ddd;margin:12px 0"/>
    <p style="margin:0 0 6px"><b>Prompt para o dev</b> (copie e cole no agente com acesso ao código):</p>
    <pre style="white-space:pre-wrap;background:#f6f8fa;border:1px solid #e1e4e8;border-radius:8px;padding:12px;font-size:12px">${escapeHtml(
      devPrompt,
    )}</pre>
  </div>`;

  const subject =
    kind === "erro"
      ? `[Pracinha][Erro] ${(error?.message ?? "erro").slice(0, 60)}`
      : `[Pracinha] ${(storeName || turns[turns.length - 1]?.content || "suporte").slice(0, 60)}`;

  return { subject, html, text };
}

function buildErrorPrompt(
  contextLines: string[],
  error: DevReportInput["error"],
  body: string,
): string {
  return `Você é engenheiro no projeto "cardapio-cidadela" (React + TanStack Start + Vite + Nitro + Supabase + Cloudflare Pages). Um erro foi capturado automaticamente em produção pelo suporte Pracinha. Encontre a causa raiz no código e corrija.

CONTEXTO
${contextLines.map((l) => `- ${l}`).join("\n")}

${body}

O QUE FAZER
1. Procure no código pela mensagem do erro e pelo componente/página indicados.
2. Reproduza a causa raiz em src/routes, src/components ou src/modules/supabase (não trate só o sintoma).
3. Corrija com a menor mudança possível e, se fizer sentido, adicione um teste que falharia antes.
4. Rode a verificação: npx tsc --noEmit && npx vitest run && npm run build.
5. Abra um PR descrevendo a causa, a correção e como testou.`;
}

function buildSupportPrompt(contextLines: string[], body: string): string {
  return `Você é engenheiro no projeto "cardapio-cidadela" (React + TanStack Start + Vite + Nitro + Supabase + Cloudflare Pages). Um dono de restaurante relatou um problema pelo suporte. Investigue no código e corrija.

CONTEXTO DO RELATO
${contextLines.map((l) => `- ${l}`).join("\n")}

${body}

O QUE FAZER
1. Localize o código relacionado ao relato em src/routes, src/components e src/modules/supabase.
2. Identifique a causa raiz (não apenas o sintoma).
3. Corrija com a menor mudança possível.
4. Rode a verificação: npx tsc --noEmit && npx vitest run && npm run build.
5. Abra um PR descrevendo a causa, a correção e o teste.`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
