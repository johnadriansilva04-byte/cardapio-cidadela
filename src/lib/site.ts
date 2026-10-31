/**
 * Domínio público canônico do app — fonte única.
 *
 * Antes cada arquivo repetia o mesmo literal (`cardapio-cidadela.vercel.app`),
 * então trocar de domínio exigia caçar 12 ocorrências. Aqui a mudança é um
 * lugar só. O padrão continua sendo o domínio próprio; `VITE_SITE_URL` permite
 * apontar para o `*.vercel.app` (preview/staging) sem editar código.
 */

const FALLBACK_SITE_URL = "https://cardapio.pracinha.online";

function readEnv(key: string): string | undefined {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> }).env?.[key];
    return typeof v === "string" && v.trim() ? v.trim().replace(/\/+$/, "") : undefined;
  } catch {
    return undefined;
  }
}

/** Origem canônica, sem barra final (ex.: "https://cardapio.pracinha.online"). */
export const SITE_URL = readEnv("VITE_SITE_URL") || FALLBACK_SITE_URL;

/** Origem efetiva no navegador; cai para `SITE_URL` no SSR. */
export function currentOrigin(): string {
  return typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : SITE_URL;
}
