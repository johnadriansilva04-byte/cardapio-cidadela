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

/** Hosts de desenvolvimento: o link precisa apontar para o servidor local. */
const LOCAL_HOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Origem para os links compartilhados com o cliente (cardápio, acompanhamento).
 *
 * Em produção devolve sempre o domínio canônico (`SITE_URL`) — antes usávamos
 * `window.location.origin`, então um dono que abrisse o painel pelo endereço da
 * Vercel compartilhava `cardapio-cidadela.vercel.app` em vez do domínio próprio.
 * Em dev (localhost) mantém a origem local, senão o link apontaria para produção.
 */
export function currentOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    if (LOCAL_HOST_RE.test(origin)) return origin;
  }
  return SITE_URL;
}
