// Pacotes de assinatura do Cardápio Cidadela — fonte única.
//
// A landing e a tela de assinatura renderizam daqui, em vez de repetir a mesma
// lista de recursos em dois lugares. Mudou o pacote, muda num arquivo só.
//
// São dois pacotes pagos (Mensal e Anual) além do plano Gratuito:
//  - Mensal: tudo do gratuito + pedidos ilimitados + a Pracinha montando o
//    cardápio por conversa.
//  - Anual: tudo do mensal + leitura do cardápio por FOTO (IA de visão). Essa
//    função custa por uso (token de imagem), então é o diferencial que justifica
//    o anual — no mensal ela não entra.
//
// A diária (24h) é compra avulsa, não um pacote; ela vive em `pricing.ts`.

import {
  DAY_PASS_PRICE_LABEL,
  DAY_PASS_PRICE_VALUE,
  MONTHLY_PRICE_LABEL,
  MONTHLY_PRICE_VALUE,
  PREMIUM_PRICE_LABEL,
  PREMIUM_PRICE_VALUE,
  formatMonthlyEquivalent,
} from "@/lib/pricing";

export type PlanKey = "free" | "monthly" | "annual";

/** Chaves de recurso: o texto vive em `PLAN_FEATURES`, os pacotes citam a chave. */
export type PlanFeatureKey =
  | "menu"
  | "orders_free"
  | "orders_unlimited"
  | "realtime"
  | "link_qr"
  | "order_details"
  | "chat_setup"
  | "multi_store"
  | "cancel_anytime"
  | "photo_menu_ai";

export const PLAN_FEATURES: Record<PlanFeatureKey, string> = {
  menu: "Cardápio completo com link e QR Code",
  orders_free: "5 pedidos por mês, sem pagar nada",
  orders_unlimited: "Pedidos ilimitados",
  realtime: "Pedidos em tempo real no celular",
  link_qr: "Link e QR Code prontos para divulgar",
  order_details: "Detalhes e itens de cada pedido liberados",
  chat_setup: "Pracinha monta seu cardápio por conversa",
  multi_store: "Todos os restaurantes da conta",
  cancel_anytime: "Cancele quando quiser, sem multa",
  photo_menu_ai: "Manda a foto do seu menu e a IA monta o cardápio",
};

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  tagline: string;
  /** Preço numérico, para cálculo (0 no gratuito). */
  priceValue: number;
  /** Rótulo pt-BR do preço (ex.: "R$ 28,99/mês"). */
  priceLabel: string;
  /** Equivalente mensal, só no anual (ex.: "R$ 16,67"). */
  monthlyEquivalent?: string;
  /** Texto curto do botão. */
  ctaLabel: string;
  /** Selo opcional no topo do cartão. */
  badge?: string;
  /** Recursos exibidos no cartão, em ordem. */
  features: PlanFeatureKey[];
}

export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: "free",
    name: "Gratuito",
    tagline: "para sempre, sem cartão",
    priceValue: 0,
    priceLabel: "R$ 0",
    ctaLabel: "Começar grátis",
    features: ["menu", "orders_free", "realtime", "link_qr"],
  },
  monthly: {
    key: "monthly",
    name: "Mensal",
    tagline: "renova todo mês",
    priceValue: MONTHLY_PRICE_VALUE,
    priceLabel: MONTHLY_PRICE_LABEL,
    ctaLabel: "Assinar mensal",
    features: ["orders_unlimited", "order_details", "chat_setup", "multi_store", "cancel_anytime"],
  },
  annual: {
    key: "annual",
    name: "Anual",
    tagline: "renova a cada ano",
    priceValue: PREMIUM_PRICE_VALUE,
    priceLabel: PREMIUM_PRICE_LABEL,
    monthlyEquivalent: formatMonthlyEquivalent(PREMIUM_PRICE_VALUE),
    ctaLabel: "Assinar anual",
    badge: "Melhor valor",
    features: [
      "orders_unlimited",
      "order_details",
      "chat_setup",
      "photo_menu_ai",
      "multi_store",
      "cancel_anytime",
    ],
  },
};

export const PLAN_ORDER: PlanKey[] = ["free", "monthly", "annual"];

/** `true` quando o pacote inclui o recurso. */
export function planHasFeature(plan: PlanKey, feature: PlanFeatureKey): boolean {
  return PLANS[plan].features.includes(feature);
}

/**
 * A leitura de cardápio por foto é exclusiva do anual (custo de IA por uso).
 * É a checagem que o servidor repete antes de gastar token — aqui é só UI.
 */
export function planAllowsPhotoScan(plan: PlanKey): boolean {
  return planHasFeature(plan, "photo_menu_ai");
}

/** Diária (compra avulsa, fora dos pacotes) — reexport para a UI ter uma fonte. */
export const DAY_PASS_INFO = {
  priceValue: DAY_PASS_PRICE_VALUE,
  priceLabel: DAY_PASS_PRICE_LABEL,
} as const;

/** Texto único do recurso exclusivo do anual, para o aviso de upgrade. */
export const PHOTO_SCAN_UPSELL =
  "A leitura do cardápio por foto é exclusiva do plano Anual. Faça o upgrade e a Pracinha monta o cardápio inteiro a partir da foto.";
