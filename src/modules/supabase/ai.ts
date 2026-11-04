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
  notified: boolean;
}

/**
 * Envia a conversa de suporte. A rota responde e, em paralelo, encaminha o
 * relato por e-mail — `notified` diz se o encaminhamento saiu.
 */
export async function sendSupportMessage(
  messages: SupportTurn[],
  accessToken: string | undefined,
  storeId?: string,
): Promise<SupportReply | null> {
  if (!accessToken) return null;
  try {
    const res = await fetch("/api/support/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messages, storeId }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as Partial<SupportReply>;
    if (!data.reply) return null;
    return { reply: data.reply, notified: Boolean(data.notified) };
  } catch {
    return null;
  }
}
