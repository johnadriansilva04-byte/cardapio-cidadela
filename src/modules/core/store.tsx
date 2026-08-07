import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AppState } from "@/lib/types";

interface StoreShape extends AppState {
  update: (fn: (state: AppState) => void) => void;
}

const initialCategories: AppState["categories"] = [
  {
    id: "cat-lanches",
    name: "LANCHES",
    items: [
      {
        id: "item-1",
        name: "X-Trincheira",
        desc: "Pão brioche, hambúrguer 180g, cheddar, bacon e molho da casa",
        price: 32,
        img: "",
      },
      {
        id: "item-2",
        name: "X-Pracinha",
        desc: "Pão australiano, dois hambúrgueres, queijo prato e salada",
        price: 38,
        img: "",
      },
    ],
  },
  {
    id: "cat-porcoes",
    name: "PORÇÕES",
    items: [
      {
        id: "item-3",
        name: "Fritas Brio",
        desc: "Batata rústica com páprica defumada e maionese verde",
        price: 24,
        img: "",
      },
    ],
  },
  {
    id: "cat-bebidas",
    name: "BEBIDAS",
    items: [
      { id: "item-4", name: "Refrigerante Lata", desc: "350ml gelado", price: 8, img: "" },
      { id: "item-5", name: "Água Mineral", desc: "500ml com ou sem gás", price: 5, img: "" },
    ],
  },
];

export const useStore = create<StoreShape>()(
  persist(
    (set) => ({
      store: {
        name: "Cantina do Pracinha",
        slogan: "Sabor de trincheira, brio de veterano",
        marquee: "ENTREGA EM ATÉ 35 MIN • PIX APROVADO NA HORA",
      },
      payment: { pixKey: "" },
      admin: { accessKey: "", discountTiers: [] },
      whatsapp: "",
      categories: initialCategories,
      orders: [],
      soberania: { points: 0, history: [] },
      cidadela: { codes: [] },
      integrations: { n8nWebhookUrl: "" },

      update: (fn) =>
        set((state) => {
          const draft = JSON.parse(JSON.stringify(state)) as AppState;
          fn(draft);
          return draft;
        }),
    }),
    {
      name: "cardapio_state",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        store: s.store,
        payment: s.payment,
        admin: s.admin,
        whatsapp: s.whatsapp,
        categories: s.categories,
        orders: s.orders,
        soberania: s.soberania,
        cidadela: s.cidadela,
        integrations: s.integrations,
      }),
    },
  ),
);
