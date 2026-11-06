import type { RestaurantFormValues } from "@/components/admin/RestaurantDialog";

/**
 * Chama a extração por IA e devolve os campos prontos para o formulário.
 *
 * A rota devolve só o que identificou; o chamador mescla no formulário. `null`
 * em falha (rede, token, rate limit) — a UI mantém o formulário como está e
 * avisa, sem nunca bloquear a criação manual.
 */
export async function extractRestaurantText(
  text: string,
  accessToken: string | undefined,
): Promise<{ fields: Partial<RestaurantFormValues>; ai: boolean } | null> {
  if (!accessToken || !text.trim()) return null;
  try {
    const res = await fetch("/api/restaurant/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text: text.slice(0, 2000) }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as {
      fields?: Partial<RestaurantFormValues>;
      ai?: boolean;
    };
    if (!data.fields) return null;
    return { fields: data.fields, ai: Boolean(data.ai) };
  } catch {
    return null;
  }
}

export interface SupportTurn {
  role: "user" | "assistant";
  content: string;
}

export interface SupportReply {
  reply: string;
  /** `true` quando o relato foi encaminhado por e-mail ao time. */
  escalated: boolean;
  /** `true` quando o e-mail realmente saiu (Resend configurado e OK). */
  notified: boolean;
}

export interface SupportContext {
  storeId?: string;
  storeName?: string;
  /** Força o encaminhamento mesmo sem a IA marcar — o botão "Enviar para o time". */
  escalate?: boolean;
}

/** Contexto técnico do relato, montado no navegador de quem está reclamando. */
function reportMeta() {
  if (typeof window === "undefined") return undefined;
  return {
    url: window.location.href,
    userAgent: navigator.userAgent,
    screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`,
    locale: navigator.language,
  };
}

/**
 * Envia a conversa do Pracinha. Quando `escalate` é `true` (ou a IA decide),
 * a rota devolve o relato por e-mail com o prompt pronto para o dev.
 */
export async function sendSupportMessage(
  messages: SupportTurn[],
  accessToken: string | undefined,
  context: SupportContext = {},
): Promise<SupportReply | null> {
  if (!accessToken) return null;
  try {
    const res = await fetch("/api/support/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages,
        storeId: context.storeId,
        storeName: context.storeName,
        escalate: context.escalate,
        meta: reportMeta(),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as Partial<SupportReply>;
    if (!data.reply) return null;
    return {
      reply: data.reply,
      escalated: Boolean(data.escalated),
      notified: Boolean(data.notified),
    };
  } catch {
    return null;
  }
}
