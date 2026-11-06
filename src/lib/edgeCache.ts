/**
 * Regras de cache de borda (Cloudflare) para o HTML do SSR.
 *
 * O cardápio público é montado no CLIENTE: o HTML que o SSR devolve é o mesmo
 * shell para qualquer visitante (os dados chegam do Supabase depois, por
 * efeito). Isso permite servir esse HTML do cache da Cloudflare. Numa fila de
 * balcão, dezenas de pessoas abrem o MESMO link em minutos — sem cache, cada
 * abertura é uma invocação do Worker, e o plano grátis tem teto de 100.000/dia.
 * Com `s-maxage`, uma invocação serve todas na janela (e o TTFB no 4G cai).
 *
 * Só o cardápio público e a landing entram. Painel, mobile, pedido e qualquer
 * `/api` ficam de fora de propósito: HTML autenticado (ou resposta de API)
 * nunca pode ser compartilhado entre visitantes.
 *
 * Módulo puro (sem React/Cloudflare) para poder testar a decisão sem subir um
 * Worker.
 */

export type EdgeCacheRule = {
  test: (pathname: string) => boolean;
  value: string;
};

export const EDGE_CACHE_RULES: EdgeCacheRule[] = [
  // Cardápio público: muda raramente e o snapshot do cliente cobre o resto.
  {
    test: (p) => p.startsWith("/cardapio/"),
    value: "public, s-maxage=60, stale-while-revalidate=300",
  },
  // Landing: estática na prática.
  { test: (p) => p === "/", value: "public, s-maxage=300, stale-while-revalidate=600" },
];

/**
 * Devolve o `Cache-Control` de borda para uma resposta, ou `null` quando ela
 * não deve ser cacheada na CDN.
 *
 * @param pathname       caminho da requisição (ex.: "/cardapio/abc")
 * @param contentType    valor do header `content-type` da resposta
 * @param hasCacheControl `true` quando a própria resposta já definiu cache
 *                        (ex.: o sitemap) — nesse caso não sobrescrevemos
 */
export function edgeCacheControlFor(
  pathname: string,
  contentType: string | null,
  hasCacheControl: boolean,
  hasSetCookie = false,
): string | null {
  if (hasCacheControl) return null;
  if (!(contentType ?? "").includes("text/html")) return null;
  // Resposta que emite cookie carrega estado de sessão: nunca vai para um cache
  // compartilhado, mesmo num caminho público.
  if (hasSetCookie) return null;
  return EDGE_CACHE_RULES.find((r) => r.test(pathname))?.value ?? null;
}
