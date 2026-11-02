/**
 * Envio de e-mail server-only (API HTTP do Resend, sem dependência nova).
 *
 * O projeto não tinha nenhum caminho de e-mail até agora: o pedido de nota
 * ficava só na tabela `invoice_requests` e ninguém era avisado. Como o dono
 * pede a nota e o fornecedor precisa EMITIR, o pedido tem que chegar em algum
 * lugar — este módulo é esse caminho.
 *
 * Sem `RESEND_API_KEY` configurada o envio é um no-op que loga: o pedido já
 * está gravado no banco (fonte da verdade) e a fila continua consultável pelo
 * painel, então a falta da chave não pode derrubar o registro.
 *
 * NUNCA importar isto no bundle do cliente: a chave é server-only (sem VITE_).
 */
import { COMPANY } from "@/lib/company";
import { INVOICE_KIND_LABELS } from "@/lib/invoice";
import { readEnv } from "./mercadopago";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** `true` quando não há chave configurada (não é erro do pedido). */
  skipped?: boolean;
  error?: string;
}

/** Destino dos avisos de nota. Configurável; cai no suporte do COMPANY. */
export function getInvoiceNotifyEmail(env?: Record<string, string | undefined>): string {
  return readEnv("INVOICE_NOTIFY_EMAIL", env) || COMPANY.supportEmail;
}

/**
 * Remetente. `onboarding@resend.dev` é o endereço que o Resend aceita sem
 * domínio verificado e só entrega para o e-mail dono da conta — que é
 * exatamente o caso aqui (o destino é a caixa de suporte). Ao verificar um
 * domínio próprio, defina `EMAIL_FROM` com ele.
 */
export function getEmailFrom(env?: Record<string, string | undefined>): string {
  return readEnv("EMAIL_FROM", env) || "Cardápio Cidadela <onboarding@resend.dev>";
}

/** Escapa o que vai para o HTML — o conteúdo inclui dado digitado pelo dono. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface InvoiceEmailData {
  id: string;
  restaurantName: string;
  kind: string;
  quantity: number;
  amountCents: number | null;
  personType: string;
  taxId: string;
  legalName: string;
  email: string;
  address: string | null;
  notes: string | null;
  createdAt: string;
}

/** Formata centavos em reais; `null` vira "—" (valor é preenchido pelo emissor). */
function brlFromCents(cents: number | null): string {
  if (cents === null || cents === undefined) return "—";
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * Monta o e-mail do pedido de nota. Puro de propósito: dá para testar o
 * conteúdo sem rede e sem banco.
 */
export function buildInvoiceEmail(data: InvoiceEmailData): EmailMessage {
  const kindLabel = INVOICE_KIND_LABELS[data.kind] ?? data.kind;
  const subject = `Pedido de nota fiscal · ${data.restaurantName} · ${kindLabel}`;

  const rows: Array<[string, string]> = [
    ["Loja", data.restaurantName],
    ["Compra", `${kindLabel}${data.quantity > 1 ? ` (${data.quantity}×)` : ""}`],
    ["Valor", brlFromCents(data.amountCents)],
    ["Tomador", data.personType === "cnpj" ? "Pessoa jurídica (CNPJ)" : "Pessoa física (CPF)"],
    [data.personType === "cnpj" ? "CNPJ" : "CPF", data.taxId],
    ["Nome/Razão social", data.legalName],
    ["E-mail para a nota", data.email],
    ["Endereço", data.address || "—"],
    ["Observação", data.notes || "—"],
    ["Pedido em", data.createdAt],
    ["ID do pedido", data.id],
  ];

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px">
  <h2 style="margin:0 0 4px">Pedido de nota fiscal</h2>
  <p style="margin:0 0 16px;color:#555">Emitir a NFS-e e enviar para <strong>${esc(data.email)}</strong>.</p>
  <table style="border-collapse:collapse;width:100%">
    ${rows
      .map(
        ([label, value]) =>
          `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;font-size:13px">${esc(label)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px"><strong>${esc(value)}</strong></td>
          </tr>`,
      )
      .join("")}
  </table>
  <p style="margin:16px 0 0;color:#888;font-size:12px">
    Pedido registrado pelo app. O dono vê o andamento em Assinatura → Nota fiscal.
  </p>
</div>`;

  const text = [
    "PEDIDO DE NOTA FISCAL",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");

  return { to: getInvoiceNotifyEmail(), subject, html, text };
}

/**
 * Envia via Resend. Devolve `skipped` quando não há chave — o chamador decide
 * se isso é aviso ou silêncio.
 */
export async function sendEmail(
  message: EmailMessage,
  env?: Record<string, string | undefined>,
): Promise<SendEmailResult> {
  const apiKey = readEnv("RESEND_API_KEY", env);
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY ausente — e-mail não enviado:", message.subject);
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getEmailFrom(env),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error("[email] Resend falhou:", res.status, detail);
      return { ok: false, error: `provedor retornou ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] falha de rede:", e);
    return { ok: false, error: "falha de rede ao enviar o e-mail" };
  }
}
