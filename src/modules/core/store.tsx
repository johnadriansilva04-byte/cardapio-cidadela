import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Restaurant, Category, Product, CartItem } from "@/lib/types";

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
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setLoading: (loading: boolean) => void;
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

      addToCart: (product) => {
        const { cart } = get();
        const existing = cart.find((item) => item.product.id === product.id);
        if (existing) {
          set({
            cart: cart.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + 1 }
                : item,
            ),
          });
        } else {
          set({ cart: [...cart, { product, quantity: 1, notes: "" }] });
        }
      },

      removeFromCart: (productId) => {
        const { cart } = get();
        const existing = cart.find((item) => item.product.id === productId);
        if (existing && existing.quantity > 1) {
          set({
            cart: cart.map((item) =>
              item.product.id === productId
                ? { ...item, quantity: item.quantity - 1 }
                : item,
            ),
          });
        } else {
          set({ cart: cart.filter((item) => item.product.id !== productId) });
        }
      },

      updateCartQuantity: (productId, quantity) => {
        const { cart } = get();
        if (quantity <= 0) {
          set({ cart: cart.filter((item) => item.product.id !== productId) });
        } else {
          set({
            cart: cart.map((item) =>
              item.product.id === productId ? { ...item, quantity } : item,
            ),
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
