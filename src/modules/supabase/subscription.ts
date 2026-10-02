import { supabase } from "./client";
import type { SubscriptionStatus } from "@/lib/types";

/**
 * Assinatura Premium via Mercado Pago.
 *
 * O plano gratuito permite um número limitado de pedidos por mês; o Premium é
 * ilimitado e é ativado automaticamente pelo webhook de preapproval do Mercado
 * Pago (`src/api/webhook/mercadopago.ts`).
 *
 * Os dados de assinatura vivem em `admin_trials`, uma linha por restaurante
 * (`store_id` = `restaurants.id`). Se a linha ainda não existir, é criada sob
 * demanda — assim a assinatura funciona para contas novas, sem depender do
 * fluxo legado de trial.
 *
 * Tudo degrada em silêncio: se as colunas novas ainda não existirem no banco
 * (migração não aplicada), o restaurante é tratado como gratuito e os pedidos
 * continuam funcionando.
 */

export const MONTHLY_FREE_LIMIT = 5;

const COLUMNS =
  "store_id, admin_email, is_premium, premium_expires_at, monthly_order_count, monthly_order_reset_date";

interface SubscriptionRow {
  store_id: string | null;
  admin_email: string | null;
  is_premium: boolean | null;
  premium_expires_at: string | null;
  monthly_order_count: number | null;
  monthly_order_reset_date: string | null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

/** Premium só vale enquanto a data de expiração não passou (null = sem prazo). */
function premiumActive(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const ts = Date.parse(expiresAt);
  return Number.isFinite(ts) ? ts > Date.now() : true;
}

async function fetchRow(storeId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("admin_trials")
    .select(COLUMNS)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) {
    console.warn("[subscription] falha ao ler assinatura:", error.message);
    return null;
  }
  return (data as SubscriptionRow) ?? null;
}

/** Garante uma linha de assinatura para o restaurante. */
async function ensureRow(storeId: string): Promise<SubscriptionRow | null> {
  const existing = await fetchRow(storeId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("admin_trials")
    .insert({
      store_id: storeId,
      monthly_order_count: 0,
      monthly_order_reset_date: todayISO(),
    })
    .select(COLUMNS)
    .single();
  if (error) {
    // Pode ter sido criada em paralelo por outro pedido — relê.
    console.warn("[subscription] falha ao criar linha:", error.message);
    return await fetchRow(storeId);
  }
  return data as SubscriptionRow;
}

async function patchRow(storeId: string, values: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("admin_trials").update(values).eq("store_id", storeId);
  if (error) {
    console.warn("[subscription] falha ao atualizar assinatura:", error.message);
    return false;
  }
  return true;
}

function toStatus(row: SubscriptionRow | null): SubscriptionStatus {
  const used = Math.max(0, Number(row?.monthly_order_count ?? 0) || 0);
  const isPremium = Boolean(row?.is_premium) && premiumActive(row?.premium_expires_at ?? null);
  return {
    isPremium,
    monthlyOrderCount: used,
    monthlyLimit: MONTHLY_FREE_LIMIT,
    remainingOrders: Math.max(0, MONTHLY_FREE_LIMIT - used),
    premiumExpiresAt: row?.premium_expires_at ?? null,
    resetDate: row?.monthly_order_reset_date ?? todayISO(),
  };
}

/** Reseta o contador quando virou o mês (comparação por ano-mês). */
export async function resetMonthlyCountIfNeeded(storeId: string): Promise<void> {
  const row = await fetchRow(storeId);
  if (!row) return;
  const reset = row.monthly_order_reset_date;
  if (!reset) {
    await patchRow(storeId, { monthly_order_reset_date: todayISO() });
    return;
  }
  if (monthKey(reset) !== monthKey(todayISO())) {
    await patchRow(storeId, {
      monthly_order_count: 0,
      monthly_order_reset_date: todayISO(),
    });
  }
}

/** Verifica se é premium ou gratuito, com o uso do mês corrente. */
export async function checkSubscriptionStatus(storeId: string): Promise<SubscriptionStatus> {
  await resetMonthlyCountIfNeeded(storeId);
  return toStatus(await fetchRow(storeId));
}

/** Incrementa o contador de pedidos do mês (após um pedido criado com sucesso). */
export async function incrementOrderCount(storeId: string): Promise<void> {
  await resetMonthlyCountIfNeeded(storeId);
  const row = await ensureRow(storeId);
  if (!row) return;
  const next = Math.max(0, Number(row.monthly_order_count ?? 0) || 0) + 1;
  await patchRow(storeId, { monthly_order_count: next });
}

/**
 * Retorna se o restaurante ainda pode receber pedidos neste mês.
 * Premium nunca é bloqueado.
 */
export async function checkMonthlyLimit(
  storeId: string,
): Promise<{ allowed: boolean; remaining: number; used: number; isPremium: boolean }> {
  await resetMonthlyCountIfNeeded(storeId);
  const row = await fetchRow(storeId);
  const status = toStatus(row);
  return {
    allowed: status.isPremium || status.remainingOrders > 0,
    remaining: status.remainingOrders,
    used: status.monthlyOrderCount,
    isPremium: status.isPremium,
  };
}

/** Ativa o Premium — chamado pelo webhook quando o preapproval é aprovado. */
export async function activatePremium(
  storeId: string,
  preapprovalId: string,
  payerEmail: string,
  expiresAt?: string | null,
): Promise<boolean> {
  await ensureRow(storeId);
  const expires = expiresAt || nextBillingDate();
  return patchRow(storeId, {
    is_premium: true,
    premium_expires_at: expires,
    mercadopago_preapproval_id: preapprovalId,
    mercadopago_payer_email: payerEmail || null,
  });
}

/** Cancela o Premium — assinatura volta ao plano gratuito. */
export async function cancelPremium(storeId: string): Promise<boolean> {
  return patchRow(storeId, {
    is_premium: false,
    premium_expires_at: null,
    mercadopago_preapproval_id: null,
  });
}

function nextBillingDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

/**
 * Guarda o e-mail do pagador antes de abrir o checkout. É o que permite
 * correlacionar o webhook (que pode não trazer `external_reference`) com o
 * restaurante certo.
 */
export async function registerPendingSubscription(
  storeId: string,
  payerEmail: string,
): Promise<void> {
  if (!payerEmail) return;
  await ensureRow(storeId);
  try {
    await patchRow(storeId, {
      admin_email: payerEmail,
      mercadopago_payer_email: payerEmail,
    });
  } catch {
    /* admin_email é UNIQUE — colisão não deve derrubar o fluxo de pagamento */
  }
}

/** Resolve o restaurante pelo e-mail do pagador (fallback do webhook). */
export async function findStoreIdByPayerEmail(payerEmail: string): Promise<string | null> {
  if (!payerEmail) return null;
  const { data: byMp } = await supabase
    .from("admin_trials")
    .select("store_id")
    .eq("mercadopago_payer_email", payerEmail)
    .not("store_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (byMp?.store_id) return byMp.store_id as string;
  const { data: byAdmin } = await supabase
    .from("admin_trials")
    .select("store_id")
    .eq("admin_email", payerEmail)
    .not("store_id", "is", null)
    .limit(1)
    .maybeSingle();
  return (byAdmin?.store_id as string) ?? null;
}

/** Preapproval ativo registrado para o restaurante (usado no "Gerenciar"). */
export async function getPreapprovalId(storeId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("admin_trials")
    .select("mercadopago_preapproval_id")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error || !data) return null;
  return (data.mercadopago_preapproval_id as string) ?? null;
}
