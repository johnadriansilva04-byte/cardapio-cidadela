/**
 * Registro único e guardado do service worker.
 * Nunca registra em dev, iframe ou previews do Lovable — e suporta ?sw=off.
 */
const SW_URL = "/sw.js";

function shouldRefuse(): boolean {
  // Verificação SSR antes de acessar variáveis de ambiente
  if (typeof window === "undefined") return true;
  if (typeof import.meta !== 'undefined' && !import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).has("sw")) {
    return new URLSearchParams(window.location.search).get("sw") === "off";
  }
  return false;
}

async function unregisterApp() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

export async function registerAppServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (shouldRefuse()) {
    await unregisterApp();
    return;
  }
  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({ immediate: true });
  } catch {
    /* plugin ausente em dev */
  }
}
