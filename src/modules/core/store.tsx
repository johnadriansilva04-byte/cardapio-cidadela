import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Restaurant, Category, Product, CartItem, SelectedAddon } from "@/lib/types";
import { deriveCartOwner, shouldResetCart } from "@/lib/cartScope";

interface PlatformState {
  // Current restaurant being managed
  restaurant: Restaurant | null;
  categories: Category[];
  products: Product[];

  // Cart (for public menu)
  cart: CartItem[];
  /**
   * Restaurante dono do carrinho atual. Persistido junto com o carrinho para
   * que um carregamento direto em outro cardápio consiga detectar o vazamento
   * (antes só existia o ref de slug em memória, que não sobrevive ao reload).
   */
  cartRestaurantId: string | null;

  // UI state
  isLoading: boolean;

  // Actions
  setRestaurant: (restaurant: Restaurant | null) => void;
  setMenu: (categories: Category[], products: Product[]) => void;
  setCart: (cart: CartItem[]) => void;
  /** Troca o conteúdo do carrinho e registra a qual restaurante ele pertence. */
  setCartFor: (cart: CartItem[], restaurantId: string | null) => void;
  /** Descarta o carrinho quando ele pertence a outro restaurante. */
  discardCartIfForeign: (restaurantId: string | null | undefined) => boolean;
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
      cartRestaurantId: null,
      isLoading: false,

      setRestaurant: (restaurant) => set({ restaurant }),

      setMenu: (categories, products) => set({ categories, products }),

      // Deriva o dono das próprias linhas quando possível; se as linhas não
      // trazem restaurant_id, preserva o dono já conhecido.
      setCart: (cart) =>
        set((state) => ({
          cart,
          cartRestaurantId:
            deriveCartOwner(cart) ?? (cart.length > 0 ? state.cartRestaurantId : null),
        })),

      setCartFor: (cart, restaurantId) => set({ cart, cartRestaurantId: restaurantId }),

      discardCartIfForeign: (restaurantId) => {
        const { cart, cartRestaurantId } = get();
        if (!shouldResetCart(cart, restaurantId, cartRestaurantId)) return false;
        set({ cart: [], cartRestaurantId: null });
        return true;
      },

      addToCart: (product, addons = [], notes = "") => {
        const { cart } = get();
        const key = addonsKey(addons);
        // Primeira linha define o dono do carrinho.
        const cartRestaurantId = get().cartRestaurantId ?? product.restaurant_id ?? null;
        const existing = cart.find((item) => isSameCartLine(item, product.id, key));
        if (existing) {
          set({
            cart: cart.map((item) =>
              isSameCartLine(item, product.id, key) ? { ...item, quantity: item.quantity + 1 } : item,
            ),
            cartRestaurantId,
          });
        } else {
          set({ cart: [...cart, { product, quantity: 1, notes, addons }], cartRestaurantId });
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

      clearCart: () => set({ cart: [], cartRestaurantId: null }),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "platform_cart",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (s) => ({ cart: s.cart, cartRestaurantId: s.cartRestaurantId }),
      // Carrinhos da v1 não tinham dono; derivamos das linhas para que o
      // primeiro cardápio aberto já consiga descartá-lo se for de outro lugar.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<PlatformState>;
        const cart = state.cart ?? [];
        return {
          cart,
          cartRestaurantId: state.cartRestaurantId ?? deriveCartOwner(cart),
        };
      },
    },
  ),
);
