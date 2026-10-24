import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mpFetch,
  normalizePreapproval,
  searchPaymentsByExternalReference,
  type PreapprovalInfo,
  type ServerEnv,
} from "./mercadopago";

/**
 * Processamento server-side de assinaturas do Mercado Pago.
 *
 * Compartilhado entre o webhook (automático) e a sincronização manual (botão
 * "Sincronizar", fallback quando o webhook não chega).
 *
 * A correlação com o restaurante é por LOJA (`external_reference` = store_id,
 * enviado no link) e, como fallback, por TELEFONE do pagador. Nunca por e-mail:
 * o app autentica por telefone e o e-mail da conta é um pseudo-endereço interno
 * (`<ddd><numero>@menufacil.local`) que o Mercado Pago não conhece.
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
  // external_reference é o store_id que enviamos no link. Um e-mail nunca é um
  // store_id válido — se vier um, é dado legado e deve ser descartado.
  return Boolean(value) && !value.includes("@");
}

/**
 * Descobre a qual restaurante um preapproval pertence.
 *
 * Ordem: `external_reference` (store_id enviado no link) → telefone do pagador
 * (RPC SECURITY DEFINER; o webhook/sync usa a service role). Sem correlação
 * possível, devolve null e nada é ativado.
 */
async function resolveStoreId(
  supabase: SupabaseClient,
  info: PreapprovalInfo,
): Promise<string | null> {
  if (isExternalReference(info.externalReference)) return info.externalReference;

  if (info.payerPhone) {
    const { data } = await supabase.rpc("find_store_by_phone", {
      p_phone: info.payerPhone,
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
        // Telefone do pagador é a identidade de correlação (não há e-mail real).
        admin_phone: info.payerPhone || null,
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
 * Sincronização manual: busca os pagamentos da LOJA pelo `external_reference`
 * (o store_id que enviamos no link), acha um aprovado e ativa. Retorna o
 * resultado para a UI.
 *
 * A busca é pela loja, não pelo pagador: o app é por telefone e o e-mail da
 * conta é um pseudo-endereço que o Mercado Pago não conhece — procurar por ele
 * nunca encontrava nada. A posse da loja já é validada na rota (token de sessão
 * + RLS do próprio usuário) antes de chamar esta função.
 */
export async function syncSubscriptionForStore(
  supabase: SupabaseClient,
  storeId: string,
  env?: ServerEnv,
): Promise<{ status: "premium" | "free" | "none"; preapprovalId: string | null }> {
  if (!storeId) return { status: "none", preapprovalId: null };

  const payments = await searchPaymentsByExternalReference(storeId, env);
  if (payments.length === 0) return { status: "none", preapprovalId: null };

  // Prefere um aprovado; senão, assume que não há pagamento válido.
  const approved = payments.find((p) => p.status === "approved");
  if (!approved) {
    return { status: "free", preapprovalId: payments[0]?.id ?? null };
  }

  const { data: row } = await supabase
    .from("admin_trials")
    .select("store_id, admin_phone")
    .eq("store_id", storeId)
    .maybeSingle();

  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  const { error } = await supabase.from("admin_trials").upsert(
    {
      store_id: storeId,
      is_premium: true,
      premium_expires_at: expires.toISOString(),
      // Guarda o telefone do pagador quando o checkout o informa; senão mantém
      // o que já estava registrado para a loja.
      admin_phone: approved.payerPhone || (row?.admin_phone as string | null) || null,
    },
    { onConflict: "store_id" },
  );
  if (error) return { status: "none", preapprovalId: null };

  return { status: "premium", preapprovalId: approved.id };
}
