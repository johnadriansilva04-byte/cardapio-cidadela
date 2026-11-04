/**
 * Monta o relato de suporte/erro que chega por e-mail no mesmo formato, sempre.
 *
 * O e-mail tem DUAS partes, nesta ordem:
 *   1. "Para o CEO" — o recado curto, humano, sem jargão. É o que se lê primeiro.
 *   2. "Para o dev" — o prompt pronto para colar no agente que tem o código.
 *
 * O mesmo e-mail serve aos dois papéis: o CEO entende o que houve, e o
 * funcionário (o agente com acesso ao código) recebe a tarefa já montada.
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

const GREETING_NAME = "CEO";
const BRAND = "Cardápio Cidadela";
const SIGNATURE = "Pracinha · Suporte da Variant";
const DIVIDER = "────────────────────────────────────────";

export function buildDevReport(input: DevReportInput): DevReport {
  const { kind, ownerEmail, storeId, storeName, meta, turns = [], error } = input;
  const isError = kind === "erro";
  const when = formatWhen(new Date());

  // Fatos "de gente": só o que o CEO precisa para se situar.
  const ceoFacts: Array<[string, string]> = [["Loja", storeName || "não informada"]];
  ceoFacts.push(["Quando", when]);

  // Fatos "de dev": contexto técnico completo, só na parte de baixo.
  const devFacts: Array<[string, string]> = [["Loja", storeName || "não informada"]];
  if (storeId) devFacts.push(["ID da loja", storeId]);
  devFacts.push(["Conta", ownerEmail || "desconhecida"]);
  devFacts.push(["Página", meta?.url || error?.route || "não informada"]);
  if (meta?.screen) devFacts.push(["Tela", meta.screen]);
  if (meta?.locale) devFacts.push(["Idioma", meta.locale]);
  if (meta?.userAgent) devFacts.push(["Dispositivo", meta.userAgent]);
  devFacts.push(["Quando", when]);

  const contextLines = devFacts.map(([label, value]) => `${label}: ${value}`);

  const story = isError
    ? `${error?.message ?? "erro"}\nComponente: ${error?.component ?? "não identificado"}\n\n${error?.stack ?? "(sem stack)"}`
    : turns.map((t) => `${t.role === "user" ? "Cliente" : "Pracinha"}: ${t.content}`).join("\n\n");

  const devPrompt = isError
    ? buildErrorPrompt(contextLines, error, story)
    : buildSupportPrompt(contextLines, story);

  // ---- Para o CEO: uma frase clara, sem jargão ----
  const ceoSummary = isError
    ? `Um cliente esbarrou num erro no app${storeName ? ` na loja ${storeName}` : ""}. Nada foi perdido: o pedido continua salvo e o cliente pode seguir. O time já tem tudo o que precisa para corrigir.`
    : `Um cliente pediu ajuda pelo chat${storeName ? ` da loja ${storeName}` : ""} e o caso precisa de uma olhada no código. A conversa completa está abaixo.`;

  // O assunto é a primeira coisa que o CEO vê na caixa de entrada: nada de
  // mensagem de erro em inglês. A loja identifica o caso; o técnico fica no corpo.
  const subject = isError
    ? storeName
      ? `[Pracinha] Erro no app · ${storeName.slice(0, 50)}`
      : "[Pracinha] Erro no app"
    : `[Pracinha] Relato de cliente · ${(storeName || turns[turns.length - 1]?.content || "suporte").slice(0, 50)}`;

  // No relato de suporte a conversa é o miolo — o CEO lê. No erro, o stack é
  // jargão e fica só na parte do dev.
  const ceoStoryText = isError
    ? []
    : ["", "CONVERSA", ...turns.map((t) => `${t.role === "user" ? "Cliente" : "Pracinha"}: ${t.content}`)];

  const text = [
    `${BRAND} · Variant`,
    isError ? "Erro no app" : "Relato de cliente",
    "",
    `Olá, ${GREETING_NAME}!`,
    "",
    ceoSummary,
    "",
    ...ceoFacts.map(([label, value]) => `${label}: ${value}`),
    ...ceoStoryText,
    "",
    DIVIDER,
    "PARA O DEV — copie daqui para baixo e cole no agente com o código",
    DIVIDER,
    "",
    devPrompt,
    "",
    `— ${SIGNATURE}`,
  ].join("\n");

  const factsHtml = ceoFacts
    .map(
      ([label, value]) => `<tr>
        <td style="padding:3px 16px 3px 0;color:#8a8a8a;font-size:13px;white-space:nowrap;vertical-align:top">${esc(label)}</td>
        <td style="padding:3px 0;font-size:13px;color:#1a1a1a">${esc(value)}</td>
      </tr>`,
    )
    .join("");

  const storyHtml = isError
    ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.55"><strong>${esc(error?.message ?? "erro")}</strong></p>
       <p style="margin:0 0 12px;color:#666;font-size:13px">Componente: ${esc(error?.component ?? "não identificado")}</p>
       <pre style="white-space:pre-wrap;background:#faf7f7;border:1px solid #eee;border-radius:10px;padding:12px;font-size:11.5px;line-height:1.5;color:#5a2a2a;margin:0">${esc(error?.stack ?? "(sem stack)")}</pre>`
    : turns
        .map(
          (t) => `<div style="margin:0 0 10px">
          <span style="font-size:12px;font-weight:600;color:${t.role === "user" ? "#2563eb" : "#8a8a8a"}">${t.role === "user" ? "Cliente" : "Pracinha"}</span>
          <p style="margin:2px 0 0;font-size:14px;line-height:1.55">${esc(t.content)}</p>
        </div>`,
        )
        .join("");

  // Para o CEO, a conversa do suporte é legível e vale a pena; o stack de erro, não.
  const ceoStoryBlock = isError
    ? ""
    : `<p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9a9a9a">Conversa</p>
  <div style="margin:0 0 26px">${storyHtml}</div>`;

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;color:#1a1a1a;max-width:600px;margin:0 auto;line-height:1.5">
  <p style="margin:0 0 2px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9a9a9a">${esc(BRAND)} · Variant</p>
  <h1 style="margin:0 0 20px;font-size:19px;font-weight:600">${isError ? "Erro no app" : "Relato de cliente"}</h1>

  <p style="margin:0 0 6px">Olá, ${esc(GREETING_NAME)}!</p>
  <p style="margin:0 0 20px;color:#444">${esc(ceoSummary)}</p>

  <table style="border-collapse:collapse;width:100%;margin:0 0 24px">${factsHtml}</table>

  ${ceoStoryBlock}

  <table style="border-collapse:collapse;width:100%;margin:0 0 10px"><tr>
    <td style="border-top:1px solid #e6e8eb;padding-top:16px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9a9a9a">Para o dev</td>
  </tr></table>
  <p style="margin:0 0 8px;color:#666;font-size:13px">Copie o bloco abaixo e cole no agente com acesso ao código.</p>
  <pre style="white-space:pre-wrap;background:#f6f8fa;border:1px solid #e6e8eb;border-radius:10px;padding:14px;font-size:12px;line-height:1.55;color:#24292f;margin:0">${esc(devPrompt)}</pre>

  <p style="margin:24px 0 0;color:#9a9a9a;font-size:13px">— ${esc(SIGNATURE)}</p>
</div>`;

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

/** Data/hora em BRT, curta e legível (sem depender de ICU do runtime). */
function formatWhen(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return `${p(brt.getUTCDate())}/${p(brt.getUTCMonth() + 1)}/${brt.getUTCFullYear()} às ${p(brt.getUTCHours())}:${p(brt.getUTCMinutes())}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
