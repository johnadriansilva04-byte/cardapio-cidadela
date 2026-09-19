import type { CartItem } from "@/lib/types";

/**
 * Dono do carrinho — o restaurante a que as linhas pertencem.
 *
 * O carrinho vive em localStorage e não tinha dono, então podia ser
 * reaberto no cardápio de outro restaurante (link direto, PWA reaberto,
 * `restaurantId` era o único guard). Aqui derivamos o dono de forma
 * determinística para poder compará-lo com o cardápio aberto.
 */
export function deriveCartOwner(cart: CartItem[]): string | null {
  for (const line of cart) {
    const id = line.product?.restaurant_id;
    if (id) return id;
  }
  return null;
}

/**
 * Decide se o carrinho precisa ser descartado ao abrir um cardápio.
 *
 * Regras:
 * - carrinho vazio: nada a fazer.
 * - `storedOwner` nulo (carrinho gravado antes desta mudança): cai no dono
 *   derivado das próprias linhas, para também limpar no upgrade.
 * - sem dono derivável: mantém, para não apagar carrinho de dado incompleto.
 * - dono diferente do restaurante aberto: descarta.
 */
export function shouldResetCart(
  cart: CartItem[],
  currentRestaurantId: string | null | undefined,
  storedOwner: string | null | undefined,
): boolean {
  if (cart.length === 0) return false;
  if (!currentRestaurantId) return false;

  const owner = storedOwner ?? deriveCartOwner(cart);
  if (!owner) return false;

  return owner !== currentRestaurantId;
}

/** True quando a linha pertence a outro restaurante que não o aberto. */
export function cartLineBelongsToOtherRestaurant(
  line: CartItem,
  currentRestaurantId: string | null | undefined,
): boolean {
  const owner = line.product?.restaurant_id;
  if (!owner || !currentRestaurantId) return false;
  return owner !== currentRestaurantId;
}
