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
