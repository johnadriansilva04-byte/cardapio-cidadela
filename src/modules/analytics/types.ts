// Tipos do analytics. O objetivo é ter um vocabulário fechado de eventos:
// só o que está no catálogo é enviado, então um erro de digitação nunca vira
// um evento órfão no destino.

export type AnalyticsEventName =
  | "page_view"
  | "menu_opened"
  | "product_added_to_cart"
  | "cart_opened"
  | "checkout_opened"
  | "order_created"
  | "order_tracked"
  | "review_submitted"
  | "install_prompt_shown"
  | "install_accepted";

/** Propriedades primitivas — o destino é texto/JSON simples, sem objetos aninhados. */
export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  props: AnalyticsProps;
  /** Epoch ms em que o evento foi capturado. */
  at: number;
  /** Identificador anônimo por dispositivo (não é o usuário do Supabase). */
  anonId: string;
  /** Caminho da página no momento do evento, útil para page_view. */
  path: string;
}

export interface AnalyticsConfig {
  /**
   * Endpoint que recebe os eventos por `navigator.sendBeacon`/`fetch`.
   * Sem endpoint configurado o módulo existe, mas não envia nada.
   */
  endpoint?: string;
  /** Força o analytics ligado mesmo sem endpoint (útil para debug local). */
  debug?: boolean;
  /** Quantos eventos acumular antes de enviar em lote. */
  flushAt?: number;
  /** Tempo máximo (ms) que um evento espera antes do envio em lote. */
  flushIntervalMs?: number;
}

export interface AnalyticsStatus {
  enabled: boolean;
  /** `true` quando o usuário recusou explicitamente o rastreamento. */
  optedOut: boolean;
  /** `true` quando o navegador pede para não rastrear. */
  doNotTrack: boolean;
  hasEndpoint: boolean;
}
