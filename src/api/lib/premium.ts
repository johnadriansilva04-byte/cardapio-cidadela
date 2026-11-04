import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Predicado de Premium do lado do SERVIDOR.
 *
 * Mesma regra do banco (`store_is_unlocked`, parte Premium): `is_premium` E
 * `premium_expires_at > now()`. É fail-closed de propósito — sem data de
 * vencimento não há Premium (a regra antiga de "IS NULL = sem prazo" deixava
 * qualquer linha malformada virar assinatura perpétua).
 *
 * Usado para restringir recursos de servidor (o garçom digital) sem depender do
 * cliente: o botão pode até esconder, mas quem decide é aqui. Roda com o
 * service role, então enxerga a linha mesmo com a RLS restrita ao dono.
 */
export async function isStorePremium(supabase: SupabaseClient, storeId: string): Promise<boolean> {
  if (!storeId) return false;
  const { data } = await supabase
    .from("admin_trials")
    .select("is_premium, premium_expires_at")
    .eq("store_id", storeId)
    .maybeSingle();
  if (!data?.is_premium || !data.premium_expires_at) return false;
  return new Date(data.premium_expires_at as string).getTime() > Date.now();
}
