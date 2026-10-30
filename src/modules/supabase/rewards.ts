import { supabase } from "./client";

/**
 * Recompensas por engajamento — a loja ganha DIÁRIAS (acesso de 24h).
 *
 * Tudo é leitura para o cliente; a concessão das diárias acontece no servidor
 * (`evaluate_rewards` no cron) e o saldo vive em `store_day_credits`, que o
 * dono não pode escrever. O resgate (`redeemDayPass`) só consome o saldo.
 *
 * Degrada em silêncio: sem a migração aplicada as RPCs não existem e a UI
 * mostra a cota padrão, sem travar nada.
 */

export interface RewardProgress {
  reward_id: string;
  title: string;
  metric: "orders" | "usage_seconds" | string;
  threshold: number;
  /** Legado: pedidos bônus (0 no modelo de diárias). */
  bonus_orders: number;
  /** Quantas diárias a meta concede. */
  day_credits: number;
  progress: number;
  granted: boolean;
}

/** Pedidos bônus conquistados no mês (eleva a cota do plano gratuito). */
export async function fetchBonusOrders(storeId: string): Promise<number> {
  const { data, error } = await supabase.rpc("owner_bonus_orders", { p_store: storeId });
  if (error) return 0;
  return Math.max(0, Number(data ?? 0) || 0);
}

/** Segundos online da loja no mês (dentro do horário de funcionamento). */
export async function fetchUsageSeconds(storeId: string): Promise<number> {
  const { data, error } = await supabase.rpc("owner_usage_seconds", { p_store: storeId });
  if (error) return 0;
  return Math.max(0, Number(data ?? 0) || 0);
}

/** Metas do mês com o progresso da loja (para o banner e o "próximo objetivo"). */
export async function fetchRewards(storeId: string): Promise<RewardProgress[]> {
  const { data, error } = await supabase.rpc("owner_rewards", { p_store: storeId });
  if (error || !Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    reward_id: String(r.reward_id ?? ""),
    title: String(r.title ?? ""),
    metric: String(r.metric ?? ""),
    threshold: Number(r.threshold ?? 0) || 0,
    bonus_orders: Number(r.bonus_orders ?? 0) || 0,
    day_credits: Number(r.day_credits ?? 0) || 0,
    progress: Number(r.progress ?? 0) || 0,
    granted: Boolean(r.granted),
  }));
}

/**
 * Batimento de tempo online. O servidor limita a 120s por chamada, então um
 * cliente adulterado não infla o tempo. Best-effort: falha silenciosa.
 */
export async function bumpUsage(storeId: string, seconds: number): Promise<number | null> {
  const { data, error } = await supabase.rpc("bump_store_usage", {
    p_store: storeId,
    p_seconds: Math.max(0, Math.round(seconds)),
  });
  if (error) return null;
  return Math.max(0, Number(data ?? 0) || 0);
}
