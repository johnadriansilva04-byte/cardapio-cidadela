import { supabase } from "./client";
import { getGuestId, getMyOrders } from "@/lib/guestOrder";
import type { ClaimResult, Promotion, SovereigntyBalance } from "@/lib/loyalty";
import type { GuestOrderSummary } from "@/lib/types";

/**
 * Remove o guest id local depois que os pedidos e pontos foram reivindicados
 * pela conta. Sem isso o convidado continuaria "existindo" no dispositivo e
 * as próximas consultas públicas poderiam reivindicar dados já migrados.
 */
export function clearGuestIdentity(): void {
  try {
    localStorage.removeItem("cardapio_cidadela_guest_id");
    localStorage.removeItem("cardapio_cidadela_my_orders");
    localStorage.removeItem("last_order");
  } catch {
    /* storage indisponível */
  }
}

/**
 * Move para a conta autenticada tudo o que foi feito como convidado neste
 * dispositivo. É idempotente: a RPC só toca registros ainda órfãos.
 * Nunca lança — falhar aqui não deve impedir o login.
 */
export async function claimGuestData(): Promise<ClaimResult> {
  const guestId = getGuestId();
  if (!guestId) return { points: 0, orders: 0 };

  try {
    const { data, error } = await supabase.rpc("claim_guest_data", { p_guest: guestId });
    if (error) {
      // Migração ainda não aplicada: mantém o guest id para o fluxo legado.
      return { points: 0, orders: 0 };
    }
    const result = (data ?? {}) as Partial<ClaimResult>;
    clearGuestIdentity();
    return { points: Number(result.points ?? 0), orders: Number(result.orders ?? 0) };
  } catch {
    return { points: 0, orders: 0 };
  }
}

/**
 * Histórico do cliente.
 *
 * Com conta: o histórico vem da própria conta (customer_id), então aparece
 * em qualquer aparelho. Sem conta: cai no guest id deste navegador, que é o
 * comportamento antigo — o convidado continua servindo para quem não quer
 * se cadastrar, só deixa de ser a única forma.
 */
export async function getCustomerOrders(userId?: string | null): Promise<GuestOrderSummary[]> {
  if (!userId) return getMyOrders();

  try {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, restaurant_id, comanda, status, total, delivery_type, payment_method, created_at, restaurants(name)",
      )
      .eq("customer_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !Array.isArray(data)) return getMyOrders();

    return data.map((row) => {
      const r = row as unknown as GuestOrderSummary & { restaurants?: { name?: string } };
      return {
        id: r.id,
        restaurant_id: r.restaurant_id,
        restaurant_name: r.restaurants?.name ?? "",
        comanda: r.comanda,
        status: r.status,
        total: Number(r.total ?? 0),
        delivery_type: r.delivery_type ?? "retirada",
        payment_method: r.payment_method ?? "pix",
        created_at: r.created_at,
      };
    });
  } catch {
    return getMyOrders();
  }
}

/** Saldo de pontos de soberania (SOV), por restaurante. */
export async function getSovereigntyBalances(): Promise<SovereigntyBalance[]> {
  try {
    const { data, error } = await supabase.rpc("get_my_sovereignty");
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => {
      const r = row as unknown as SovereigntyBalance;
      return {
        restaurant_id: r.restaurant_id,
        restaurant_name: r.restaurant_name,
        balance: Number(r.balance ?? 0),
        earned: Number(r.earned ?? 0),
        spent: Number(r.spent ?? 0),
      };
    });
  } catch {
    return [];
  }
}

/** Promoções públicas de um restaurante (some sozinha se a migração não rodou). */
export async function getRestaurantPromotions(slug: string): Promise<Promotion[]> {
  try {
    const { data, error } = await supabase.rpc("get_restaurant_promotions", { p_slug: slug });
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => {
      const r = row as unknown as Promotion;
      return { ...r, value: Number(r.value ?? 0) };
    });
  } catch {
    return [];
  }
}

/** Resgata uma promoção com pontos. Retorna erro legível para a UI. */
export async function redeemPromotion(
  promotionId: string,
): Promise<{ ok: boolean; balance?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("redeem_promotion", {
      p_promotion: promotionId,
    });
    if (error) return { ok: false, error: error.message };
    const result = (data ?? {}) as { balance?: number };
    return { ok: true, balance: Number(result.balance ?? 0) };
  } catch {
    return { ok: false, error: "Não foi possível resgatar a promoção agora." };
  }
}
