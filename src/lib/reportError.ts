/**
 * Reporta um erro do app para o time (Pracinha), sem nunca quebrar a tela.
 *
 * Chamado pelo error boundary do root e por erros globais do navegador. Monta o
 * contexto (página, dispositivo) e faz POST para `/api/support/error`, que
 * envia o relato por e-mail com o prompt pronto para o dev.
 *
 * É silencioso e best-effort: falha de rede, rota ausente ou SSR não podem
 * gerar um segundo erro — o objetivo é avisar, não piorar. Deduplica no cliente
 * pela mensagem para o mesmo erro não disparar a cada re-render do boundary.
 */

const sent = new Set<string>();

/**
 * Ruído de navegadores in-app (Instagram/Facebook `iabjs://`), não do app.
 *
 * O "Android WebView" do Instagram injeta um script próprio
 * (`navigation_performance_logger_android`) que chama `postMessage` na bridge
 * nativa. Quando o usuário fecha a aba no meio da navegação, a bridge já não
 * existe e o script lança `Error invoking postMessage: Java object is gone` —
 * o `window.onerror` do nosso root captura e reporta, mas a falha é 100% do
 * host (o app nunca usa `postMessage`). Filtrar evita abrir um caso urgente de
 * "cardápio quebrado" para um erro que não afeta nenhum cliente.
 */
const BRIDGE_NOISE = /iabjs:\/\/|Java object is gone/i;

/** `true` quando o erro vem da bridge do navegador in-app, não do app. */
export function isThirdPartyBridgeNoise(error: unknown): boolean {
  const { message, stack } = describe(error);
  return BRIDGE_NOISE.test(message) || (!!stack && BRIDGE_NOISE.test(stack));
}

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack };
  }
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

export function reportError(
  error: unknown,
  context: { component?: string; storeId?: string; storeName?: string } = {},
): void {
  if (typeof window === "undefined") return;
  if (isThirdPartyBridgeNoise(error)) return;
  const { message, stack } = describe(error);
  if (!message) return;

  const key = message.slice(0, 120);
  if (sent.has(key)) return;
  sent.add(key);

  const body = JSON.stringify({
    message,
    stack,
    component: context.component,
    storeId: context.storeId,
    storeName: context.storeName,
    route: window.location.pathname,
    meta: {
      url: window.location.href,
      userAgent: navigator.userAgent,
      screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`,
      locale: navigator.language,
    },
  });

  // `keepalive` ajuda o relato a sair mesmo se a página estiver indo embora.
  void fetch("/api/support/error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
