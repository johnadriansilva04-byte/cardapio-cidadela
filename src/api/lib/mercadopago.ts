import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers server-only do Mercado Pago.
 *
 * O Access Token dá acesso total à conta do Mercado Pago e por isso NUNCA pode
 * ir para o bundle do cliente. Lemos `MERCADOPAGO_ACCESS_TOKEN` (server-side);
 * `VITE_MERCADOPAGO_ACCESS_TOKEN` só existe como compatibilidade e deve ser
 * evitado. O link de assinatura, por ser público, pode ser `VITE_*`.
 */

export type ServerEnv = Record<string, string | undefined>;

export function readEnv(key: string, env?: ServerEnv): string {
  if (env?.[key]) return env[key] as string;
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> }).env?.[key];
    if (typeof v === "string" && v) return v;
  } catch {
    /* ignore */
  }
  try {
    const v = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process
      ?.env?.[key];
    if (typeof v === "string" && v) return v;
  } catch {
    /* ignore */
  }
  return "";
}

export const MP_API_BASE = "https://api.mercadopago.com";

/**
 * Cliente Supabase agindo COMO o usuário (anon key + token de sessão). O RLS é
 * aplicado com a identidade dele, então serve para validar posse de recursos
 * (ex.: confirmar que o restaurante pertence ao dono autenticado).
 */
export function getSupabaseForUser(token: string, env?: ServerEnv): SupabaseClient | null {
  const url = readEnv("SUPABASE_URL", env) || readEnv("VITE_SUPABASE_URL", env);
  const anon = readEnv("VITE_SUPABASE_ANON_KEY", env) || readEnv("SUPABASE_ANON_KEY", env);
  if (!url || !anon || !token) return null;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getMercadoPagoToken(env?: ServerEnv): string {
  return readEnv("MERCADOPAGO_ACCESS_TOKEN", env) || readEnv("VITE_MERCADOPAGO_ACCESS_TOKEN", env);
}

export function getWebhookSecret(env?: ServerEnv): string {
  return readEnv("MERCADOPAGO_WEBHOOK_SECRET", env);
}

/**
 * Escape hatch para desenvolvimento local sem secret. Em produção NÃO defina.
 *
 * O webhook é um endereço público: sem secret não há como provar que a
 * notificação veio do Mercado Pago, então qualquer um poderia forjar uma
 * ativação de Premium. Por isso o padrão é recusar (fail-closed).
 */
export function getWebhookAllowUnsigned(env?: ServerEnv): boolean {
  const raw = readEnv("MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED", env).toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export interface WebhookAuthParams {
  secret: string;
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
  authorization: string | null;
  /** Só para dev local; em produção o secret sempre existe. */
  allowUnsigned?: boolean;
}

export type WebhookAuthResult = { ok: true } | { ok: false; reason: string };

/**
 * Decide se a requisição do webhook pode ser processada.
 *
 * Extraído da rota para ser testável: a decisão de segurança é o ponto mais
 * sensível do fluxo de pagamento e precisa de prova automatizada.
 *
 * Regras:
 * - Com secret: exige `Bearer <secret>` OU `x-signature` HMAC válido.
 * - Sem secret: recusa, a menos que `allowUnsigned` esteja ligado (dev).
 */
export async function authorizeWebhookRequest(
  params: WebhookAuthParams,
): Promise<WebhookAuthResult> {
  const { secret, signature, requestId, dataId, authorization, allowUnsigned } = params;

  if (!secret) {
    if (allowUnsigned) return { ok: true };
    return { ok: false, reason: "MERCADOPAGO_WEBHOOK_SECRET não configurado" };
  }

  const authorized =
    authorization === `Bearer ${secret}` ||
    (await verifyMercadoPagoSignature({ signature, requestId, dataId, secret }));

  if (!authorized) return { ok: false, reason: "invalid signature" };
  return { ok: true };
}

/**
 * Cliente Supabase com privilégio de escrita. Use a service role: as policies de
 * `admin_trials` agora são restritas ao dono, então a ativação do Premium pelo
 * webhook precisa de uma credencial que ignore RLS. A anon key é mantida apenas
 * como fallback de leitura/degradação — sem service role a escrita não persiste.
 */
export function getServerSupabase(env?: ServerEnv): SupabaseClient | null {
  const url = readEnv("SUPABASE_URL", env) || readEnv("VITE_SUPABASE_URL", env);
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY", env);
  const key =
    serviceRole || readEnv("SUPABASE_ANON_KEY", env) || readEnv("VITE_SUPABASE_ANON_KEY", env);
  if (!url || !key) return null;
  if (!serviceRole) {
    console.warn(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY ausente — o webhook não conseguirá ativar o Premium (RLS de admin_trials).",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Chama a API do Mercado Pago com o Access Token. */
export async function mpFetch(
  path: string,
  init: RequestInit = {},
  env?: ServerEnv,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const token = getMercadoPagoToken(env);
  if (!token) return { ok: false, status: 0, data: { message: "Access token não configurado" } };
  const res = await fetch(`${MP_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* resposta sem corpo JSON */
  }
  return { ok: res.ok, status: res.status, data };
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Valida o header `x-signature` do Mercado Pago.
 *
 * O manifesto é `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, assinado com
 * HMAC-SHA256 usando a chave secreta do webhook. `data.id` entra em minúsculas,
 * como manda a documentação.
 */
export async function verifyMercadoPagoSignature(params: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}): Promise<boolean> {
  const { signature, requestId, dataId, secret } = params;
  if (!secret || !signature) return false;

  const parts: Record<string, string> = {};
  for (const chunk of signature.split(",")) {
    const [k, v] = chunk.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${(dataId ?? "").toLowerCase()};request-id:${requestId ?? ""};ts:${ts};`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
  const expected = toHex(digest);

  // Comparação de tempo constante.
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

export interface PreapprovalInfo {
  id: string;
  status: string;
  payerEmail: string;
  externalReference: string;
  nextPaymentDate: string | null;
}

/** Normaliza o corpo de um preapproval do Mercado Pago. */
export function normalizePreapproval(raw: unknown): PreapprovalInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? "");
  if (!id) return null;
  const next =
    (r.next_payment_date as string) ?? (r.auto_recurring as { end_date?: string })?.end_date;
  return {
    id,
    status: String(r.status ?? ""),
    payerEmail: String((r.payer_email as string) ?? ""),
    externalReference: String((r.external_reference as string) ?? ""),
    nextPaymentDate: next ?? null,
  };
}

/** Busca preapprovals de um pagador — usado pela sincronização manual. */
export async function searchPreapprovals(
  payerEmail: string,
  env?: ServerEnv,
): Promise<PreapprovalInfo[]> {
  const { ok, data } = await mpFetch(
    `/preapproval/search?payer_email=${encodeURIComponent(payerEmail)}&limit=20`,
    {},
    env,
  );
  if (!ok || !data) return [];
  const results = (data as { results?: unknown[] }).results ?? [];
  return results
    .map((r) => normalizePreapproval(r))
    .filter((p): p is PreapprovalInfo => p !== null);
}

export interface PaymentInfo {
  id: string;
  status: string;
  externalReference: string;
  dateApproved: string | null;
}

/** Normaliza um pagamento pontual do Mercado Pago (Pix/cartão/boleto). */
export function normalizePayment(raw: unknown): PaymentInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? "");
  if (!id) return null;
  return {
    id,
    status: String(r.status ?? ""),
    externalReference: String(r.external_reference ?? ""),
    dateApproved: (r.date_approved as string) ?? null,
  };
}

/**
 * Pagamentos pontuais de um restaurante, casados pelo `external_reference`.
 *
 * É o fallback do sync para quem pagou pelo link de pagamento (Pix/cartão) e
 * não por uma assinatura: nesse caso não existe preapproval para procurar.
 * Exige o prefixo `/v1` — sem ele a API devolve 404.
 */
export async function searchPaymentsByExternalReference(
  externalReference: string,
  env?: ServerEnv,
): Promise<PaymentInfo[]> {
  const { ok, data } = await mpFetch(
    `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&limit=20`,
    {},
    env,
  );
  if (!ok || !data) return [];
  const results = (data as { results?: unknown[] }).results ?? [];
  return results
    .map((r) => normalizePayment(r))
    .filter((p): p is PaymentInfo => p !== null);
}
