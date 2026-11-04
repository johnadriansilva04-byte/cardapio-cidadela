import { readEnv, type ServerEnv } from "@/api/lib/mercadopago";

/**
 * Cliente do Cloudflare Workers AI.
 *
 * Usa a API REST (`/accounts/{id}/ai/run/{model}`) com um API Token, em vez do
 * binding `env.AI`: o projeto roda em Cloudflare Pages via Nitro, onde o binding
 * não chega ao handler, e a REST é o mesmo caminho que já usamos para o Mercado
 * Pago. Sem `CLOUDFLARE_AI_TOKEN` a IA fica desligada e quem chama cai no
 * parser determinístico — nada quebra, só perde o "entender texto livre".
 *
 * Custo: o Workers AI tem cota diária gratuita e só é chamado quando o dono
 * cria/edita a loja ou pede ajuda — não é por pedido nem por visita.
 */

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
// Modelo com visão (lê imagem). Custa mais por chamada — só o plano anual usa.
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const ACCOUNT_ID = "5123773a9dbba0599ba001539d5c3cbe";

export function getAiToken(env?: ServerEnv): string {
  return readEnv("CLOUDFLARE_AI_TOKEN", env);
}

export function isAiEnabled(env?: ServerEnv): boolean {
  return Boolean(getAiToken(env));
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Roda um modelo COM VISÃO sobre uma imagem (data URL base64).
 *
 * Separado de `runAi` porque o corpo muda: a imagem vai no campo `image`, não
 * dentro de `messages`. `null` em qualquer falha — quem chama decide o fallback.
 * É a função mais cara do app (token de imagem), por isso o gate de plano vive
 * na rota, nunca aqui.
 */
export async function runAiVision(
  prompt: string,
  imageDataUrl: string,
  env?: ServerEnv,
  maxTokens = 1200,
): Promise<string | null> {
  const token = getAiToken(env);
  if (!token || !imageDataUrl) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${VISION_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          image: imageDataUrl,
          max_tokens: maxTokens,
        }),
      },
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      console.error("[ai] Workers AI (visão) falhou:", res.status, detail);
      return null;
    }
    const data = (await res.json()) as { result?: { response?: string } };
    const text = data?.result?.response;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch (err) {
    console.error("[ai] erro inesperado (visão):", err);
    return null;
  }
}

/**
 * Roda o modelo e devolve o texto da resposta.
 *
 * `null` em qualquer falha (sem token, HTTP != 200, resposta vazia): o chamador
 * decide o fallback. Nunca lança — a criação da loja não pode depender da IA.
 */
export async function runAi(
  messages: ChatMessage[],
  env?: ServerEnv,
  maxTokens = 700,
): Promise<string | null> {
  const token = getAiToken(env);
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${DEFAULT_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages, max_tokens: maxTokens }),
      },
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      console.error("[ai] Workers AI falhou:", res.status, detail);
      return null;
    }
    const data = (await res.json()) as {
      result?: { response?: string };
      success?: boolean;
    };
    const text = data?.result?.response;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch (err) {
    console.error("[ai] erro inesperado:", err);
    return null;
  }
}

/**
 * Extrai o primeiro objeto JSON de um texto que pode vir cercado de prosa.
 *
 * O modelo às vezes responde "Claro! Aqui está: {...}" mesmo instruído a
 * devolver só o JSON. Em vez de confiar no formato, recortamos do primeiro `{`
 * ao último `}` e parseamos — assim uma linha a mais não invalida a resposta.
 */
export function extractJson<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
