import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mpFetch,
  normalizePreapproval,
  searchPaymentsByExternalReference,
  searchPreapprovals,
  type PaymentInfo,
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
    // Resolve pelo e-mail via RPC SECURITY DEFINER — funciona mesmo quando o
    // webhook roda com a anon key (a tabela não é mais legível por anon).
    const { data } = await supabase.rpc("find_store_by_payer_email", {
      p_email: info.payerEmail,
    });
    if (data) return data as string;
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
    // upsert: cria a linha se ainda não existir. Um UPDATE silenciosamente sem
    // efeito (0 linhas) fazia o Premium nunca ativar sem erro — o webhook
    // devolvia 200 e o Mercado Pago não reentregava.
    const { error } = await supabase.from("admin_trials").upsert(
      {
        store_id: storeId,
        is_premium: true,
        premium_expires_at: nextBillingDate(info),
        mercadopago_preapproval_id: info.id,
        mercadopago_payer_email: info.payerEmail || null,
      },
      { onConflict: "store_id" },
    );
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

/**
 * Aplica um pagamento pontual aprovado ao restaurante do `external_reference`.
 *
 * `metadata.kind` decide o produto:
 * - `'day_pass'` → concede 24h via RPC `grant_day_pass` (idempotente pelo id);
 * - caso contrário → ativa o Premium por 1 ano (comportamento legado).
 */
export async function applyApprovedPayment(
  supabase: SupabaseClient,
  payment: PaymentInfo,
): Promise<ProcessResult> {
  if (payment.status !== "approved") {
    return {
      handled: true,
      storeId: null,
      premium: false,
      reason: `pagamento ${payment.status}`,
    };
  }

  const storeId = payment.externalReference;
  if (!isExternalReference(storeId)) {
    return { handled: false, storeId: null, premium: false, reason: "external_reference inválido" };
  }

  if (payment.kind === "day_pass") {
    const { error } = await supabase.rpc("grant_day_pass", {
      p_store: storeId,
      p_mp_payment_id: payment.id || null,
      p_amount_cents: 149,
      p_source: "pix",
      p_quantity: Math.max(1, Math.min(Number(payment.quantity ?? 1) || 1, 60)),
    });
    if (error) return { handled: false, storeId, premium: false, reason: error.message };
    return { handled: true, storeId, premium: false, reason: `diária ${payment.id} concedida` };
  }

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const { error } = await supabase.from("admin_trials").upsert(
    {
      store_id: storeId,
      is_premium: true,
      premium_expires_at: expiresAt.toISOString(),
    },
    { onConflict: "store_id" },
  );
  if (error) return { handled: false, storeId, premium: false, reason: error.message };

  return { handled: true, storeId, premium: true, reason: `pagamento ${payment.id} aprovado` };
}

/** Consulta o preapproval na API do MP e aplica. */export async function processPreapprovalById(
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
  if (preapprovals.length > 0) {
    // Prefere um ativo; senão, assume que não há assinatura válida.
    const active = preapprovals.find((p) => ACTIVE_STATUSES.has(p.status));
    const chosen = active ?? preapprovals[0];
    await applyPreapproval(supabase, chosen);
    return {
      status: active ? "premium" : "free",
      preapprovalId: chosen.id,
    };
  }

  // Sem assinatura: pode ter sido um pagamento pontual (Pix/cartão) pelo link
  // de pagamento. Antes o sync só olhava preapproval e nunca achava o Pix.
  const payments = await searchPaymentsByExternalReference(storeId, env);
  const approved = payments.find((p) => p.status === "approved");
  if (approved) {
    const applied = await applyApprovedPayment(supabase, approved);
    return { status: applied.premium ? "premium" : "none", preapprovalId: approved.id };
  }

  return { status: "none", preapprovalId: null };
}
