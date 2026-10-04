import { supabase } from "./client";

/**
 * Precificação de pedidos feita no servidor (fonte da verdade).
 *
 * Antes, `createOrder` gravava `unit_price`, `subtotal`, `delivery_fee` e
 * `total` exatamente como o navegador enviava. Como o cardápio é público e o
 * INSERT de `orders` é liberado para `anon`, qualquer pessoa podia forjar um
 * pedido com preço/total arbitrários (ex.: R$ 0,01) — e o dono só veria o valor
 * errado depois de aceitar. Agora os preços vêm sempre de `products` /
 * `product_addons` / `delivery_neighborhoods`, e o que o cliente envia é apenas
 * a intenção (produto, adicionais, quantidade).
 */

export interface PricedItemInput {
  product_id: string;
  /** Só para exibição/diagnóstico; o nome final é reconstruído do banco. */
  product_name?: string;
  quantity: number;
  notes?: string;
  /** Ids dos adicionais escolhidos — preços resolvidos no servidor. */
  addon_ids?: string[];
}

export interface PricedItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes: string;
}

export interface PricedOrder {
  items: PricedItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
}

export interface PricingInput {
  restaurantId: string;
  delivery_type: string;
  customer_neighborhood?: string | null;
  items: PricedItemInput[];
}

export class PricingError extends Error {}

interface ProductRow {
  id: string;
  name: string;
  price: number | string;
  available?: boolean | null;
}

interface AddonRow {
  id: string;
  name: string;
  price: number | string;
  restaurant_id?: string | null;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function safeQuantity(value: unknown): number {
  const n = Math.floor(toNumber(value, 1));
  return n >= 1 ? n : 1;
}

/**
 * Resolve os preços reais do pedido a partir do banco.
 * Lança `PricingError` quando um item não existe, está indisponível ou o
 * restaurante não confere — nunca grava um total que o cliente inventou.
 */
export async function resolveOrderPricing(input: PricingInput): Promise<PricedOrder> {
  const { restaurantId, delivery_type, customer_neighborhood } = input;

  const productIds = [...new Set(input.items.map((i) => i.product_id).filter(Boolean))];
  const addonIds = [...new Set(input.items.flatMap((i) => i.addon_ids ?? []).filter(Boolean))];

  const [productsResult, addonsResult, restaurantResult, neighborhoodResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, price, available")
      .eq("restaurant_id", restaurantId)
      .in("id", productIds),
    addonIds.length
      ? supabase.from("product_addons").select("id, name, price, restaurant_id").in("id", addonIds)
      : Promise.resolve({ data: [] as AddonRow[], error: null }),
    supabase.from("restaurants").select("delivery_fee").eq("id", restaurantId).maybeSingle(),
    delivery_type === "entrega" && customer_neighborhood
      ? supabase
          .from("delivery_neighborhoods")
          .select("name, fee")
          .eq("restaurant_id", restaurantId)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (productsResult.error) {
    throw new PricingError("Não foi possível validar os preços. Tente novamente.");
  }

  const productMap = new Map(((productsResult.data ?? []) as ProductRow[]).map((p) => [p.id, p]));

  // Tabela de adicionais pode não existir em bancos antigos — nesse caso o
  // pedido segue sem adicionais em vez de falhar por inteiro.
  const addonMap = new Map<string, AddonRow>();
  if (!addonsResult.error) {
    for (const a of (addonsResult.data ?? []) as AddonRow[]) addonMap.set(a.id, a);
  } else if (!String(addonsResult.error.message).toLowerCase().includes("product_addons")) {
    throw new PricingError("Não foi possível validar os preços. Tente novamente.");
  }

  const priced: PricedItem[] = input.items.map((raw) => {
    const product = productMap.get(raw.product_id);
    if (!product) {
      throw new PricingError(
        "Um item do seu carrinho não está mais disponível. Recarregue o cardápio.",
      );
    }
    if (product.available === false) {
      throw new PricingError(`"${product.name}" está indisponível no momento.`);
    }

    const quantity = safeQuantity(raw.quantity);
    let addonSum = 0;
    const addonNames: string[] = [];
    for (const id of raw.addon_ids ?? []) {
      const addon = addonMap.get(id);
      // Adicional de outro restaurante (ou inexistente) é descartado, não cobrado.
      if (!addon) continue;
      if (addon.restaurant_id && addon.restaurant_id !== restaurantId) continue;
      addonSum += toNumber(addon.price);
      addonNames.push(addon.name);
    }

    const unitPrice = round2(toNumber(product.price) + addonSum);
    const name = addonNames.length ? `${product.name} (+ ${addonNames.join(", ")})` : product.name;

    return {
      product_id: product.id,
      product_name: name,
      quantity,
      unit_price: unitPrice,
      total: round2(unitPrice * quantity),
      notes: raw.notes ?? "",
    };
  });

  const subtotal = round2(priced.reduce((sum, i) => sum + i.total, 0));

  let deliveryFee = 0;
  if (delivery_type === "entrega") {
    const neighborhoods = (neighborhoodResult.data ?? []) as {
      name: string;
      fee?: number | string;
    }[];
    const wanted = customer_neighborhood?.trim().toLowerCase();
    // Match exato (case-insensitive) feito em JS: um `ilike` deixaria o cliente
    // mandar "%" e casar com qualquer bairro — inclusive um mais barato.
    const neighborhood = wanted
      ? neighborhoods.find((n) => n.name.trim().toLowerCase() === wanted)
      : undefined;
    deliveryFee = round2(
      toNumber(neighborhood?.fee, toNumber(restaurantResult.data?.delivery_fee)),
    );
  }

  return {
    items: priced,
    subtotal,
    delivery_fee: deliveryFee,
    total: round2(subtotal + deliveryFee),
  };
}
