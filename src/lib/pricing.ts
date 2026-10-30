/**
 * Preço do Premium (assinatura anual). Fica fora de `modules/supabase` para a
 * landing poder exibi-lo sem arrastar o cliente Supabase para o bundle público.
 *
 * O valor é configurável por env para permitir testes de cobrança (ex.: R$ 1,00)
 * sem alterar código:
 * - `VITE_PREMIUM_PRICE_VALUE` → valor numérico cobrado pelo Mercado Pago
 * - `VITE_PREMIUM_ANNUAL_PRICE` → rótulo exibido na UI
 * Sem env, vale o padrão de produção (R$ 199,99/ano) e o rótulo sai do valor.
 */

/** Valor padrão do plano anual, em reais. */
const DEFAULT_PRICE_VALUE = 199.99;

function readEnv(key: string): string | undefined {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> }).env?.[key];
    return typeof v === "string" && v.trim() ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Aceita "1", "1,00" e "1.00"; ignora vazio, inválido ou não-positivo. */
export function parsePriceValue(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Rótulo pt-BR do plano anual (ex.: 1 → "R$ 1,00/ano"). */
export function formatPremiumPriceLabel(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}/ano`;
}

/** Valor numérico do Premium (fonte única — usado no link de pagamento do MP). */
export const PREMIUM_PRICE_VALUE =
  parsePriceValue(readEnv("VITE_PREMIUM_PRICE_VALUE")) ?? DEFAULT_PRICE_VALUE;

export const PREMIUM_PRICE_LABEL =
  readEnv("VITE_PREMIUM_ANNUAL_PRICE") || formatPremiumPriceLabel(PREMIUM_PRICE_VALUE);
