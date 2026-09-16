import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Restaurant, Category, Product, CartItem, SelectedAddon } from "@/lib/types";

interface PlatformState {
  // Current restaurant being managed
  restaurant: Restaurant | null;
  categories: Category[];
  products: Product[];

  // Cart (for public menu)
  cart: CartItem[];

  // Slug da loja a que o carrinho pertence — o carrinho é persistido no
  // dispositivo, então precisa saber quando o cliente trocou de restaurante.
  restaurantSlug: string | null;

  // UI state
  isLoading: boolean;

  // Actions
  setRestaurant: (restaurant: Restaurant | null) => void;
  setMenu: (categories: Category[], products: Product[]) => void;
  setCart: (cart: CartItem[]) => void;
  addToCart: (product: Product, addons?: SelectedAddon[], notes?: string) => void;
  removeFromCart: (productId: string, addons?: SelectedAddon[]) => void;
  updateCartQuantity: (productId: string, quantity: number, addons?: SelectedAddon[]) => void;
  clearCart: () => void;
  setLoading: (loading: boolean) => void;
  /** Marca o carrinho como pertencente a esta loja, descartando itens de outra. */
  syncCartRestaurant: (slug: string, restaurantId: string) => void;
}

// helpers — duas linhas são "iguais" só se tiverem mesmo produto + mesmos adicionais
function addonsKey(addons?: SelectedAddon[]): string {
  if (!addons || addons.length === 0) return "";
  return [...addons]
    .map((a) => a.addon_id)
    .sort()
    .join(",");
}
function isSameCartLine(a: CartItem, productId: string, key: string): boolean {
  return a.product.id === productId && addonsKey(a.addons) === key;
}

export const usePlatformStore = create<PlatformState>()(
  persist(
    (set, get) => ({
      restaurant: null,
      categories: [],
      products: [],
      cart: [],
      restaurantSlug: null,
      isLoading: false,

      setRestaurant: (restaurant) => set({ restaurant }),

      setMenu: (categories, products) => set({ categories, products }),

      setCart: (cart) => set({ cart }),

      syncCartRestaurant: (slug, restaurantId) => {
        const { cart, restaurantSlug } = get();
        if (restaurantSlug === slug) return;
        // Só as linhas desta loja sobrevivem: um carrinho de outro cardápio tem
        // product_ids e preços que não valem aqui.
        set({
          restaurantSlug: slug,
          cart: cart.filter((line) => line.product.restaurant_id === restaurantId),
        });
      },

      addToCart: (product, addons = [], notes = "") => {
        const { cart } = get();
        const key = addonsKey(addons);
        const existing = cart.find((item) => isSameCartLine(item, product.id, key));
        if (existing) {
          set({
            cart: cart.map((item) =>
              isSameCartLine(item, product.id, key) ? { ...item, quantity: item.quantity + 1 } : item,
            ),
          });
        } else {
          set({ cart: [...cart, { product, quantity: 1, notes, addons }] });
        }
      },

      removeFromCart: (productId, addons) => {
        const { cart } = get();
        // se addons for fornecido, remove da variação exata; senão mantém compat: última variação
        let targetIdx = -1;
        if (addons !== undefined) {
          const key = addonsKey(addons);
          targetIdx = cart.findIndex((item) => isSameCartLine(item, productId, key));
          if (targetIdx === -1) return;
        } else {
          const indices = cart
            .map((item, idx) => (item.product.id === productId ? idx : -1))
            .filter((i) => i !== -1);
          if (indices.length === 0) return;
          targetIdx = indices[indices.length - 1];
        }
        const existing = cart[targetIdx];
        if (existing.quantity > 1) {
          set({
            cart: cart.map((item, idx) => (idx === targetIdx ? { ...item, quantity: item.quantity - 1 } : item)),
          });
        } else {
          set({ cart: cart.filter((_, idx) => idx !== targetIdx) });
        }
      },

      updateCartQuantity: (productId, quantity, addons) => {
        const { cart } = get();
        let targetIdx = -1;
        if (addons !== undefined) {
          const key = addonsKey(addons);
          targetIdx = cart.findIndex((item) => isSameCartLine(item, productId, key));
          if (targetIdx === -1) return;
        } else {
          const indices = cart
            .map((item, idx) => (item.product.id === productId ? idx : -1))
            .filter((i) => i !== -1);
          if (indices.length === 0) return;
          targetIdx = indices[indices.length - 1];
        }
        if (quantity <= 0) {
          set({ cart: cart.filter((_, idx) => idx !== targetIdx) });
        } else {
          set({
            cart: cart.map((item, idx) => (idx === targetIdx ? { ...item, quantity } : item)),
          });
        }
      },

      clearCart: () => set({ cart: [] }),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "platform_cart",
      storage: createJSONStorage(() => localStorage),
      // `restaurantSlug` acompanha o carrinho para que, ao abrir outro cardápio,
      // a gente saiba que os itens salvos são de outra loja e possa limpar.
      partialize: (s) => ({ cart: s.cart, restaurantSlug: s.restaurantSlug }),
    },
  ),
);
