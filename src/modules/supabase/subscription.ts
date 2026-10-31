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

export {
  PREMIUM_PRICE_LABEL,
  PREMIUM_PRICE_VALUE,
  MONTHLY_PRICE_LABEL,
  MONTHLY_PRICE_VALUE,
  DAY_PASS_PRICE_LABEL,
  DAY_PASS_PRICE_VALUE,
} from "@/lib/pricing";

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

/** Resposta da RPC `store_access_state` (aditiva — ausente em schema antigo). */
interface AccessState {
  unlocked: boolean;
  source: "annual" | "day" | "free";
  annual_expires_at: string | null;
  unlocked_until: string | null;
  quota_used: number;
  quota_limit: number;
  day_pass_credits?: number;
}

/**
 * Estado de acesso pela RPC SECURITY DEFINER `store_access_state`.
 *
 * É a fonte do selo e do cronômetro: devolve o `unlocked_until` exato da
 * diária e a origem do acesso (anual/diária/gratuito). Sem a migração da
 * diária a RPC não existe — devolvemos `null` e a UI cai no comportamento
 * anterior (só Premium + cota).
 */
async function fetchAccessState(storeId: string): Promise<AccessState | null> {
  const { data, error } = await supabase.rpc("store_access_state", { p_store: storeId });
  if (error || !data) return null;
  const raw = data as Partial<AccessState> & { error?: string };
  if (raw.error) return null;
  return {
    unlocked: Boolean(raw.unlocked),
    source: (raw.source as AccessState["source"]) ?? "free",
    annual_expires_at: raw.annual_expires_at ?? null,
    unlocked_until: raw.unlocked_until ?? null,
    quota_used: Math.max(0, Number(raw.quota_used ?? 0) || 0),
    quota_limit: Math.max(0, Number(raw.quota_limit ?? MONTHLY_FREE_LIMIT) || 0),
    day_pass_credits: Math.max(0, Number(raw.day_pass_credits ?? 0) || 0),
  };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

/**
 * Premium só vale com uma data de vencimento FUTURA. Sem data não há Premium:
 * a regra anterior (`null` = eterno) transformava uma linha malformada em
 * assinatura perpétua. O webhook sempre grava a data, então na prática isto só
 * fecha o buraco.
 */
function premiumActive(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  return Number.isFinite(ts) ? ts > Date.now() : false;
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

/**
 * Pedidos do mês corrente, derivados de `orders` (não do contador gravável).
 * A RPC valida a posse; sem ela (schema antigo) cai para 0 e a UI não trava.
 */
async function fetchMonthlyOrderCount(storeId: string): Promise<number> {
  const { data, error } = await supabase.rpc("owner_monthly_order_count", { p_store: storeId });
  if (error) return 0;
  return Math.max(0, Number(data ?? 0) || 0);
}

/**
 * Pedidos bônus conquistados no mês (recompensas por engajamento).
 * A RPC é aditiva: sem ela no banco (migração não aplicada) devolve 0 e a cota
 * volta ao valor padrão — nada trava.
 */
async function fetchBonusOrders(storeId: string): Promise<number> {
  const { data, error } = await supabase.rpc("owner_bonus_orders", { p_store: storeId });
  if (error) return 0;
  return Math.max(0, Number(data ?? 0) || 0);
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

function toStatus(
  row: SubscriptionRow | null,
  usedOverride?: number,
  bonusOverride?: number,
  access?: AccessState | null,
): SubscriptionStatus {
  const used = Math.max(
    0,
    Number(access?.quota_used ?? usedOverride ?? row?.monthly_order_count ?? 0) || 0,
  );
  const bonus = Math.max(0, Number(bonusOverride ?? 0) || 0);
  const limit = access ? access.quota_limit : MONTHLY_FREE_LIMIT + bonus;
  const isPremium = Boolean(row?.is_premium) && premiumActive(row?.premium_expires_at ?? null);
  const dayPassUntil = access?.unlocked_until ?? null;
  const dayPassActive =
    access?.source === "day" ||
    (dayPassUntil !== null && Number.isFinite(Date.parse(dayPassUntil))
      ? Date.parse(dayPassUntil) > Date.now()
      : false);
  const accessSource: SubscriptionStatus["accessSource"] = isPremium
    ? "annual"
    : dayPassActive
      ? "day"
      : (access?.source ?? "free");
  return {
    isPremium,
    monthlyOrderCount: used,
    monthlyLimit: limit,
    remainingOrders: Math.max(0, limit - used),
    premiumExpiresAt: row?.premium_expires_at ?? null,
    resetDate: row?.monthly_order_reset_date ?? todayISO(),
    bonusOrders: bonus,
    dayPassActive,
    dayPassUntil,
    dayPassCredits: Math.max(0, Number(access?.day_pass_credits ?? 0) || 0),
    accessSource,
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
  const [row, access] = await Promise.all([fetchRow(storeId), fetchAccessState(storeId)]);
  // Com o access state, ele já traz cota e bônus; sem ele, cai nas RPCs avulsas.
  const [used, bonus] = access
    ? [access.quota_used, Math.max(0, access.quota_limit - MONTHLY_FREE_LIMIT)]
    : await Promise.all([fetchMonthlyOrderCount(storeId), fetchBonusOrders(storeId)]);
  return toStatus(row, used, bonus, access);
}

/**
 * Retorna se o restaurante ainda pode receber pedidos neste mês.
 * Premium nunca é bloqueado; a diária libera enquanto vigorar. A contagem vem
 * dos pedidos reais do mês.
 */
export async function checkMonthlyLimit(
  storeId: string,
): Promise<{ allowed: boolean; remaining: number; used: number; isPremium: boolean }> {
  await resetMonthlyCountIfNeeded(storeId);
  const [row, access] = await Promise.all([fetchRow(storeId), fetchAccessState(storeId)]);
  const [used, bonus] = access
    ? [access.quota_used, Math.max(0, access.quota_limit - MONTHLY_FREE_LIMIT)]
    : await Promise.all([fetchMonthlyOrderCount(storeId), fetchBonusOrders(storeId)]);
  const status = toStatus(row, used, bonus, access);
  return {
    allowed: status.isPremium || status.dayPassActive || status.remainingOrders > 0,
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
  // A tabela não é legível por anon; a resolução por e-mail é feita pela RPC
  // SECURITY DEFINER `find_store_by_payer_email`.
  const { data, error } = await supabase.rpc("find_store_by_payer_email", { p_email: payerEmail });
  if (error) return null;
  return (data as string | null) ?? null;
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

/**
 * Gera o link de pagamento da diária (24h) para o restaurante.
 *
 * A rota valida a sessão e a posse do restaurante; a concessão das 24h só
 * acontece no webhook, quando o Mercado Pago confirma o pagamento. Devolve
 * `null` em qualquer falha (a UI mostra um aviso e não abre o checkout).
 */
export async function createDayPassLink(
  storeId: string,
  accessToken: string | undefined,
  quantity = 1,
): Promise<string | null> {
  if (!storeId || !accessToken) return null;
  try {
    const res = await fetch("/api/payment/day-pass", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ storeId, quantity: Math.max(1, Math.floor(quantity) || 1) }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { initPoint?: string };
    return data.initPoint ?? null;
  } catch {
    return null;
  }
}

/**
 * Gera o link de pagamento do plano mensal (30 dias) para o restaurante.
 *
 * Mesma validação da diária: a rota confere sessão e posse; a ativação só
 * acontece no webhook, quando o Mercado Pago confirma o pagamento.
 */
export async function createMonthlyLink(
  storeId: string,
  accessToken: string | undefined,
): Promise<string | null> {
  if (!storeId || !accessToken) return null;
  try {
    const res = await fetch("/api/payment/monthly", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ storeId }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { initPoint?: string };
    return data.initPoint ?? null;
  } catch {
    return null;
  }
}

/**
 * Resgata uma diária conquistada por recompensa.
 *
 * Consome 1 crédito do saldo e libera 24h. A RPC valida a posse e o saldo no
 * servidor — o cliente nunca escreve o acesso. Devolve o fim da janela (ISO)
 * ou `null` se não havia crédito/erro.
 */
export async function redeemDayPass(storeId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("redeem_day_pass", { p_store: storeId });
  if (error) return null;
  return (data as string | null) ?? null;
}

/** Saldo de diárias conquistadas (créditos não resgatados). */
export async function fetchDayPassCredits(storeId: string): Promise<number> {
  const { data, error } = await supabase.rpc("owner_day_pass_credits", { p_store: storeId });
  if (error) return 0;
  return Math.max(0, Number(data ?? 0) || 0);
}
