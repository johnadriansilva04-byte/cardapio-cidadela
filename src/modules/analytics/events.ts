import type { AnalyticsEvent, AnalyticsEventName, AnalyticsProps } from "./types";

/** Catálogo fechado: tudo fora daqui é descartado com um aviso em modo debug. */
const KNOWN_EVENTS: ReadonlySet<AnalyticsEventName> = new Set([
  "page_view",
  "menu_opened",
  "product_added_to_cart",
  "cart_opened",
  "checkout_opened",
  "order_created",
  "order_tracked",
  "review_submitted",
  "install_prompt_shown",
  "install_accepted",
]);

export function isKnownEvent(name: string): name is AnalyticsEventName {
  return KNOWN_EVENTS.has(name as AnalyticsEventName);
}

/**
 * Descarta chaves que possam carregar dado pessoal (telefone, e-mail, nome,
 * endereço). O analytics é sobre comportamento agregado, não sobre identificar
 * quem pediu — qualquer prop com essa cara sai antes de ser enviada.
 */
const PII_KEY = /(phone|telefone|email|e-?mail|name|nome|address|endereco|cpf|document)/i;

export function sanitizeProps(props: AnalyticsProps = {}): AnalyticsProps {
  const clean: AnalyticsProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (PII_KEY.test(key)) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    clean[key] = typeof value === "string" ? value.slice(0, 120) : value;
  }
  return clean;
}

export interface Envelope {
  payload: string;
  count: number;
}

/** Serializa um lote de eventos no formato aceito pelo endpoint. */
export function buildEnvelope(events: AnalyticsEvent[]): Envelope {
  return {
    payload: JSON.stringify({ events }),
    count: events.length,
  };
}

/** Hash/query não ajudam a medir navegação e podem vazar termos de busca. */
export function normalizePath(path: string): string {
  const withoutHash = path.split("#")[0] ?? "";
  return (withoutHash.split("?")[0] || "/").slice(0, 200);
}
