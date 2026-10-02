import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mpFetch,
  normalizePreapproval,
  searchPreapprovals,
  type PreapprovalInfo,
  type ServerEnv,
} from "./mercadopago";

/**
 * Processamento server-side de assinaturas do Mercado Pago.
 *
 * Compartilhado entre o webhook (automático) e a sincronização manual (botão
 * "Sincronizar", fallback quando o webhook não chega).
 */

const ACTIVE_STATUSES = new Set(["authorized", "approved", "active"]);
const CANCEL_STATUSES = new Set(["cancelled", "rejected", "paused", "expired"]);

export interface ProcessResult {
  handled: boolean;
  storeId: string | null;
  premium: boolean;
  reason: string;
}

function isExternalReference(value: string): boolean {
  // external_reference é o nome do restaurante que enviamos? Não — usamos o
  // store_id (slug) do cardápio, que nunca é um e-mail.
  return Boolean(value) && !value.includes("@");
}

/**
 * Descobre a qual restaurante um preapproval pertence.
 *
 * Ordem: `external_reference` (store_id enviado no link) → e-mail do pagador já
 * registrado em `admin_trials` → cria a linha a partir do e-mail (sem store_id,
 * será vinculada quando o usuário sincronizar pelo painel).
 */
async function resolveStoreId(
  supabase: SupabaseClient,
  info: PreapprovalInfo,
): Promise<string | null> {
  if (isExternalReference(info.externalReference)) return info.externalReference;

  if (info.payerEmail) {
    const { data } = await supabase
      .from("admin_trials")
      .select("store_id")
      .eq("mercadopago_payer_email", info.payerEmail)
      .not("store_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (data?.store_id) return data.store_id as string;

    const { data: byAdmin } = await supabase
      .from("admin_trials")
      .select("store_id")
      .eq("admin_email", info.payerEmail)
      .not("store_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (byAdmin?.store_id) return byAdmin.store_id as string;
  }

  return null;
}

function nextBillingDate(info: PreapprovalInfo): string {
  if (info.nextPaymentDate) {
    const ts = Date.parse(info.nextPaymentDate);
    if (Number.isFinite(ts)) return new Date(ts).toISOString();
  }
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

/** Aplica um preapproval ao restaurante correspondente em `admin_trials`. */
export async function applyPreapproval(
  supabase: SupabaseClient,
  info: PreapprovalInfo,
): Promise<ProcessResult> {
  const storeId = await resolveStoreId(supabase, info);

  if (!storeId) {
    return {
      handled: false,
      storeId: null,
      premium: false,
      reason: `sem restaurante para preapproval ${info.id}`,
    };
  }

  const active = ACTIVE_STATUSES.has(info.status);
  const cancelled = CANCEL_STATUSES.has(info.status);

  if (active) {
    const { error } = await supabase
      .from("admin_trials")
      .update({
        is_premium: true,
        premium_expires_at: nextBillingDate(info),
        mercadopago_preapproval_id: info.id,
        mercadopago_payer_email: info.payerEmail || null,
      })
      .eq("store_id", storeId);
    if (error) {
      return { handled: false, storeId, premium: false, reason: error.message };
    }
    return { handled: true, storeId, premium: true, reason: `status ${info.status}` };
  }

  if (cancelled) {
    const { error } = await supabase
      .from("admin_trials")
      .update({
        is_premium: false,
        premium_expires_at: null,
        mercadopago_preapproval_id: null,
      })
      .eq("store_id", storeId);
    if (error) {
      return { handled: false, storeId, premium: false, reason: error.message };
    }
    return { handled: true, storeId, premium: false, reason: `status ${info.status}` };
  }

  return { handled: true, storeId, premium: false, reason: `status ignorado: ${info.status}` };
}

/** Consulta o preapproval na API do MP e aplica. */
export async function processPreapprovalById(
  supabase: SupabaseClient,
  preapprovalId: string,
  env?: ServerEnv,
): Promise<ProcessResult> {
  const { ok, data, status } = await mpFetch(
    `/preapproval/${encodeURIComponent(preapprovalId)}`,
    {},
    env,
  );
  if (!ok) {
    return { handled: false, storeId: null, premium: false, reason: `MP HTTP ${status}` };
  }
  const info = normalizePreapproval(data);
  if (!info)
    return { handled: false, storeId: null, premium: false, reason: "preapproval inválido" };
  return applyPreapproval(supabase, info);
}

/**
 * Sincronização manual: busca os preapprovals do e-mail do dono, acha um ativo
 * e aplica. Retorna o resultado para a UI.
 *
 * Só age sobre um restaurante cujo e-mail já esteja registrado na linha de
 * assinatura — assim o e-mail sozinho não permite ativar o Premium de terceiros.
 */
export async function syncSubscriptionForEmail(
  supabase: SupabaseClient,
  storeId: string,
  payerEmail: string,
  env?: ServerEnv,
): Promise<{ status: "premium" | "free" | "none" | "forbidden"; preapprovalId: string | null }> {
  if (!storeId || !payerEmail) return { status: "none", preapprovalId: null };

  const { data: row } = await supabase
    .from("admin_trials")
    .select("store_id, admin_email, mercadopago_payer_email")
    .eq("store_id", storeId)
    .maybeSingle();

  const registered =
    row &&
    ((row.admin_email as string | null) === payerEmail ||
      (row.mercadopago_payer_email as string | null) === payerEmail);
  if (!registered) return { status: "forbidden", preapprovalId: null };

  const preapprovals = await searchPreapprovals(payerEmail, env);
  if (preapprovals.length === 0) return { status: "none", preapprovalId: null };

  // Prefere um ativo; senão, assume que não há assinatura válida.
  const active = preapprovals.find((p) => ACTIVE_STATUSES.has(p.status));
  const chosen = active ?? preapprovals[0];
  await applyPreapproval(supabase, chosen);

  return {
    status: active ? "premium" : "free",
    preapprovalId: chosen.id,
  };
}
