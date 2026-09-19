/** Tipos da conta do cliente (cardápio público) e do programa de pontos. */

/** Promoção publicada por um restaurante. */
export interface Promotion {
  id: string;
  title: string;
  description: string;
  kind: "points_multiplier" | "bonus_points" | "reward" | "discount";
  value: number;
  ends_at: string | null;
}

/** Saldo de pontos de soberania (SOV) por restaurante. */
export interface SovereigntyBalance {
  restaurant_id: string;
  restaurant_name: string;
  balance: number;
  earned: number;
  spent: number;
}

/** Resultado de reivindicar os dados do convidado para a conta real. */
export interface ClaimResult {
  points: number;
  orders: number;
}

export const PROMOTION_KIND_LABELS: Record<Promotion["kind"], string> = {
  points_multiplier: "Pontos em dobro",
  bonus_points: "Pontos de bônus",
  reward: "Recompensa",
  discount: "Desconto",
};

/** True quando a promoção é resgatável com pontos (mostra botão no perfil). */
export function isRedeemable(promo: Promotion): boolean {
  return promo.kind === "reward" && promo.value > 0;
}

/** Descrição curta do que a promoção faz, para exibir no card. */
export function describePromotion(promo: Promotion): string {
  switch (promo.kind) {
    case "points_multiplier":
      return `Ganhe ${promo.value}x pontos nos pedidos`;
    case "bonus_points":
      return `Ganhe ${promo.value} pontos extras`;
    case "discount":
      return `${promo.value}% de desconto`;
    case "reward":
      return `Troque ${promo.value} SOV por esta recompensa`;
  }
}
