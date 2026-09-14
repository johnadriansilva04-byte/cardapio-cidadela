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
      isLoading: false,

      setRestaurant: (restaurant) => set({ restaurant }),

      setMenu: (categories, products) => set({ categories, products }),

      setCart: (cart) => set({ cart }),

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
      partialize: (s) => ({ cart: s.cart }),
    },
  ),
);
