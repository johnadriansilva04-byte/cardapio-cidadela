/**
 * Preços do app (anual e diária). Fica fora de `modules/supabase` de propósito:
 * a landing precisa exibi-los sem arrastar o cliente Supabase para o bundle
 * público.
 *
 * Configuráveis por env para permitir testes de cobrança sem alterar código:
 * - `VITE_ANNUAL_PRICE_VALUE`    → valor numérico do anual (padrão 199.00)
 * - `VITE_ANNUAL_PRICE_LABEL`    → rótulo do anual exibido na UI
 * - `VITE_MONTHLY_PRICE_VALUE`   → valor numérico do mensal (padrão 28.99)
 * - `VITE_MONTHLY_PRICE_LABEL`   → rótulo do mensal exibido na UI
 * - `VITE_DAY_PASS_PRICE_VALUE`  → valor numérico da diária (padrão 1.49)
 * - `VITE_DAY_PASS_PRICE_LABEL`  → rótulo da diária exibido na UI
 *
 * `VITE_PREMIUM_PRICE_VALUE` / `VITE_PREMIUM_ANNUAL_PRICE` continuam aceitos
 * como nomes legados do anual (deploys antigos já os têm configurados).
 */

/** Valor padrão do plano anual, em reais. */
const DEFAULT_ANNUAL_PRICE_VALUE = 199.99;

/** Valor padrão do plano mensal, em reais. */
const DEFAULT_MONTHLY_PRICE_VALUE = 28.99;

/** Valor padrão da diária (24h), em reais. */
const DEFAULT_DAY_PASS_PRICE_VALUE = 1.49;

function readEnv(key: string): string | undefined {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> }).env?.[key];
    return typeof v === "string" && v.trim() ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Aceita "1", "1,49" e "1.49"; ignora vazio, inválido ou não-positivo. */
export function parsePriceValue(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Formata um valor pt-BR com o sufixo dado (ex.: 199 → "R$ 199,00/ano"). */
function formatPriceLabel(value: number, suffix: string): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}${suffix}`;
}

/** Rótulo pt-BR do plano anual (ex.: 1 → "R$ 1,00/ano"). */
export function formatPremiumPriceLabel(value: number): string {
  return formatPriceLabel(value, "/ano");
}

/** Rótulo pt-BR do plano mensal (ex.: 28.99 → "R$ 28,99/mês"). */
export function formatMonthlyPriceLabel(value: number): string {
  return formatPriceLabel(value, "/mês");
}

/** Rótulo pt-BR da diária (ex.: 1.49 → "R$ 1,49/dia"). */
export function formatDayPassPriceLabel(value: number): string {
  return formatPriceLabel(value, "/dia");
}

/**
 * Equivalente mensal do anual (ex.: 199.99 → "R$ 16,67"). Derivado do preço
 * para a landing nunca anunciar um valor que não bate com a cobrança.
 */
export function formatMonthlyEquivalent(value: number): string {
  return `R$ ${(value / 12).toFixed(2).replace(".", ",")}`;
}

/** Valor numérico do anual (fonte única — usado no link de pagamento do MP). */
export const PREMIUM_PRICE_VALUE =
  parsePriceValue(readEnv("VITE_ANNUAL_PRICE_VALUE")) ??
  parsePriceValue(readEnv("VITE_PREMIUM_PRICE_VALUE")) ??
  DEFAULT_ANNUAL_PRICE_VALUE;

export const PREMIUM_PRICE_LABEL =
  readEnv("VITE_ANNUAL_PRICE_LABEL") ||
  readEnv("VITE_PREMIUM_ANNUAL_PRICE") ||
  formatPremiumPriceLabel(PREMIUM_PRICE_VALUE);

/** Valor numérico do plano mensal (fonte única — usado no link de pagamento do MP). */
export const MONTHLY_PRICE_VALUE =
  parsePriceValue(readEnv("VITE_MONTHLY_PRICE_VALUE")) ?? DEFAULT_MONTHLY_PRICE_VALUE;

export const MONTHLY_PRICE_LABEL =
  readEnv("VITE_MONTHLY_PRICE_LABEL") || formatMonthlyPriceLabel(MONTHLY_PRICE_VALUE);

/** Valor numérico da diária de 24h. */
export const DAY_PASS_PRICE_VALUE =
  parsePriceValue(readEnv("VITE_DAY_PASS_PRICE_VALUE")) ?? DEFAULT_DAY_PASS_PRICE_VALUE;

export const DAY_PASS_PRICE_LABEL =
  readEnv("VITE_DAY_PASS_PRICE_LABEL") || formatDayPassPriceLabel(DAY_PASS_PRICE_VALUE);

/** Duração da diária, em horas — espelha o `interval '24 hours'` da RPC. */
export const DAY_PASS_HOURS = 24;
