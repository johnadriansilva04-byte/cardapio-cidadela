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
 * Extrai o texto da resposta do Workers AI, seja qual for o formato.
 *
 * O mesmo endpoint devolve `result.response` de duas formas: texto puro quando
 * o modelo responde prosa, e **objeto já parseado** quando a resposta é JSON
 * (o `llama-3.1-8b-fast-v2` faz isso). Antes só a string era aceita, então toda
 * resposta JSON era descartada em silêncio e o chamador caía no fallback
 * determinístico — a IA parecia desligada mesmo com o token certo. Também
 * cobrimos o formato OpenAI (`choices[0].message.content`), que alguns modelos
 * devolvem.
 */
export function extractAiText(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as {
    response?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  if (typeof r.response === "string" && r.response.trim()) return r.response.trim();
  if (r.response && typeof r.response === "object") return JSON.stringify(r.response);
  const choice = r.choices?.[0]?.message?.content;
  if (typeof choice === "string" && choice.trim()) return choice.trim();
  return null;
}

/**
 * Monta o corpo do Workers AI para o modelo de visão.
 *
 * A imagem vai DENTRO de `messages`, como `image_url` no `content` — é o
 * formato que a API aceita. Mandar `image` como campo de topo (o que era feito
 * antes) devolve `AiError 3030: Unable to add image when there are no
 * user-supplied nor system-supplied messages`, e a leitura por foto falhava
 * mesmo com o token certo. Pura — testável sem rede.
 */
export function buildVisionBody(prompt: string, imageDataUrl: string, maxTokens: number) {
  return {
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: prompt },
          { type: "image_url" as const, image_url: { url: imageDataUrl } },
        ],
      },
    ],
    max_tokens: maxTokens,
  };
}

/**
 * Roda um modelo COM VISÃO sobre uma imagem (data URL base64).
 *
 * `null` em qualquer falha — quem chama decide o fallback. É a função mais cara
 * do app (token de imagem), por isso o gate de plano vive na rota, nunca aqui.
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
        body: JSON.stringify(buildVisionBody(prompt, imageDataUrl, maxTokens)),
      },
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      console.error("[ai] Workers AI (visão) falhou:", res.status, detail);
      return null;
    }
    const data = (await res.json()) as { result?: unknown };
    return extractAiText(data?.result);
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
    const data = (await res.json()) as { result?: unknown; success?: boolean };
    return extractAiText(data?.result);
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
