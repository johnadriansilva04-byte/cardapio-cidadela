import { supabase } from "./client";

/**
 * Cardápio real que aparece na landing.
 *
 * A vitrine da home é o cardápio DE VERDADE da loja da Variant, carregado do
 * banco a cada visita — não um mock. Assim, quando o dono troca a foto, o preço
 * ou um item no painel, a home acompanha sozinha. Sem backend novo: a leitura é
 * pública (a loja é publicada) e cabe no cache do navegador.
 */
export const DEMO_STORE_SLUG = "dona-da-pensao";

export interface DemoMenuItem {
  id: string;
  /** Categoria à qual o item pertence (para o filtro de abas). */
  categoryId: string;
  name: string;
  description: string;
  price: number;
  /** Foto real do produto, quando houver (vem do R2 — egress zero). */
  imageUrl?: string;
  /** Emoji de reserva para itens sem foto, no estilo da vitrine da landing. */
  emoji?: string;
  tag?: string;
}

export interface DemoStoreMenu {
  name: string;
  logoUrl: string;
  categories: { id: string; name: string }[];
  items: DemoMenuItem[];
}

/** Emoji de reserva por palavra-chave do nome — só para o item sem foto. */
const FALLBACK_EMOJI: [RegExp, string][] = [
  [/bebida|refri|coca|guaran|suco|água|agua|cerveja|milkshake/i, "🥤"],
  [/porç|porc|batata|frita|frango|petisco/i, "🍟"],
  [/dog|hot/i, "🌭"],
  [/burger|x-burger|x-bacon|x-tudo|combo|lanche|cheese/i, "🍔"],
  [/pizza/i, "🍕"],
  [/doce|sobremesa|açaí|acai|sorvete/i, "🍨"],
];

function emojiFor(name: string): string {
  for (const [re, emoji] of FALLBACK_EMOJI) if (re.test(name)) return emoji;
  return "🍽️";
}

/**
 * Lê a loja-vitrine e seu cardápio. Devolve `null` se a loja não existir ou a
 * leitura falhar — o chamador cai no snapshot estático, nunca numa tela vazia.
 */
export async function getLandingDemoStore(slug = DEMO_STORE_SLUG): Promise<DemoStoreMenu | null> {
  try {
    const { data: store, error } = await supabase
      .from("restaurants")
      .select("id, name, logo_url")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !store) return null;

    const [catResult, prodResult] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, sort_order")
        .eq("restaurant_id", store.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("products")
        .select("id, category_id, name, description, price, image_url, available, sort_order")
        .eq("restaurant_id", store.id)
        .eq("available", true)
        .order("sort_order", { ascending: true }),
    ]);

    const categories = (catResult.data ?? []).map((c) => ({ id: c.id, name: c.name }));
    const items: DemoMenuItem[] = (prodResult.data ?? []).map((p) => ({
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      description: p.description ?? "",
      price: Number(p.price),
      imageUrl: p.image_url || undefined,
      emoji: p.image_url ? undefined : emojiFor(p.name),
    }));

    if (categories.length === 0 || items.length === 0) return null;

    return {
      name: store.name,
      logoUrl: store.logo_url || "",
      categories,
      items,
    };
  } catch {
    return null;
  }
}
