import { runAi, extractJson } from "@/api/lib/ai";
import type { ServerEnv } from "@/api/lib/mercadopago";

/**
 * Converte um texto livre do dono em campos do formulário de restaurante.
 *
 * Duas camadas, de propósito:
 *  1. `parseRestaurantText` — heurística determinística (telefone, taxa, PIX,
 *     nome). Roda SEMPRE, sem IA, sem rede, sem custo. É o que garante que o
 *     recurso funcione mesmo se a IA estiver desligada ou fora do ar.
 *  2. `extractRestaurantFields` — quando há IA, o modelo cobre o que regex não
 *     pega bem (endereço no meio da frase, descrição, separar nome de slogan).
 *
 * A IA NUNCA sobrescreve um campo que a heurística já achou com confiança: o
 * determinístico tem prioridade, porque é previsível. E nada aqui grava no
 * banco — o resultado só preenche o formulário, que o dono confere e salva.
 */

export interface ExtractedFields {
  name?: string;
  slug?: string;
  description?: string;
  whatsapp?: string;
  phone?: string;
  address?: string;
  pix_key?: string;
  delivery_fee?: string;
}

/** Só dígitos, com DDI 55 quando o número parece brasileiro e não tem DDI. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

/** Aceita "5", "5,00", "R$ 5.00" → "5.00". `null` se não for valor plausível. */
export function normalizeFee(raw: string): string | null {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0 || n > 999) return null;
  return n.toFixed(2);
}

/**
 * Heurística determinística. Devolve só o que achou com confiança.
 *
 * O nome é o mais difícil: assumimos que é a primeira linha "curta e sem
 * números de contato" — melhor um palpite que o dono corrige do que nada.
 */
export function parseRestaurantText(text: string): ExtractedFields {
  const out: ExtractedFields = {};
  const clean = text.trim();
  if (!clean) return out;

  // WhatsApp/telefone: procura o padrão (DD) 9xxxx-xxxx ou sequência longa.
  const phoneMatch = clean.match(/(\(?\d{2}\)?\s?9?\d{4}[-.\s]?\d{4})/);
  if (phoneMatch) {
    const normalized = normalizePhone(phoneMatch[1]);
    if (normalized) out.whatsapp = normalized;
  }

  // Taxa de entrega: "entrega 5", "frete R$ 5,00", "taxa de entrega: 7".
  const feeMatch = clean.match(/(?:entrega|frete|taxa)[^\d]{0,15}(\d{1,3}(?:[.,]\d{2})?)/i);
  if (feeMatch) {
    const fee = normalizeFee(feeMatch[1]);
    if (fee) out.delivery_fee = fee;
  }

  // Chave PIX: e-mail, telefone (já capturado) ou chave aleatória (UUID).
  const pixLabel = clean.match(/(?:pix|chave)[^\n]{0,40}?([^\s,;]+@[^\s,;]+)/i);
  if (pixLabel) {
    out.pix_key = pixLabel[1];
  } else {
    const uuid = clean.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
    if (uuid) out.pix_key = uuid[0];
  }

  // Nome: primeira linha curta, sem dígitos de contato e sem rótulo de campo.
  const firstLine = clean.split(/\n/)[0]?.trim() ?? "";
  const looksLikeName =
    firstLine.length >= 2 &&
    firstLine.length <= 60 &&
    !/^[\d\s().+-]+$/.test(firstLine) &&
    !/^(pix|chave|taxa|entrega|frete|whatsapp|telefone|endere)/i.test(firstLine);
  if (looksLikeName) {
    // Se a linha tem "Nome - slogan", separa; senão é só o nome.
    const [maybeName, maybeRest] = firstLine.split(/\s+[-–—]\s+/, 2);
    out.name = maybeName.trim().slice(0, 60);
    if (maybeRest && maybeRest.trim().length > 4) out.description = maybeRest.trim();
  }

  return out;
}

const EXTRACT_PROMPT = `Você extrai dados de restaurante a partir de um texto escrito pelo dono.
Devolva SOMENTE um objeto JSON, sem explicação, com as chaves que conseguir identificar:
{"name": "nome do restaurante", "description": "slogan ou descrição curta", "whatsapp": "só dígitos com DDI 55", "phone": "só dígitos", "address": "endereço completo", "pix_key": "chave pix", "delivery_fee": "valor só com ponto decimal"}
Omita chaves que não aparecerem. Não invente dados. Não traduza. Responda em português.`;

/**
 * Extração com IA. Complementa a heurística sem sobrescrevê-la.
 *
 * `ai` é `false` quando não houve IA (token ausente ou falha) — a UI usa isso
 * para não prometer "entendi seu texto" quando só o parser rodou.
 */
export async function extractRestaurantFields(
  text: string,
  env?: ServerEnv,
): Promise<{ fields: ExtractedFields; ai: boolean }> {
  const heuristic = parseRestaurantText(text);
  const raw = await runAi(
    [
      { role: "system", content: EXTRACT_PROMPT },
      { role: "user", content: text.slice(0, 2000) },
    ],
    env,
    500,
  );
  if (!raw) return { fields: heuristic, ai: false };

  const parsed = extractJson<Record<string, unknown>>(raw);
  if (!parsed) return { fields: heuristic, ai: false };

  const ai: ExtractedFields = {};
  const str = (k: string): string | undefined => {
    const v = parsed[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const name = str("name");
  const description = str("description");
  const address = str("address");
  const pix = str("pix_key");
  if (name) ai.name = name.slice(0, 60);
  if (description) ai.description = description.slice(0, 200);
  if (address) ai.address = address.slice(0, 200);
  if (pix) ai.pix_key = pix.slice(0, 120);
  const whatsapp = str("whatsapp");
  if (whatsapp) {
    const n = normalizePhone(whatsapp);
    if (n) ai.whatsapp = n;
  }
  const phone = str("phone");
  if (phone) {
    const n = normalizePhone(phone);
    if (n) ai.phone = n;
  }
  const fee = str("delivery_fee");
  if (fee) {
    const f = normalizeFee(fee);
    if (f) ai.delivery_fee = f;
  }

  // A heurística vence onde achou algo: é previsível e não alucina.
  return { fields: { ...ai, ...heuristic }, ai: true };
}
