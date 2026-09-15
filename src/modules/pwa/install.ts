// Captura global do `beforeinstallprompt`.
//
// O navegador dispara esse evento uma única vez, logo no carregamento da página.
// Se ninguém escutar antes desse disparo (o caso comum quando o listener vive
// dentro de um componente que ainda não montou), o evento é perdido e o botão
// "Instalar" nunca aparece. Por isso a captura mora aqui, no escopo do módulo,
// e é ativada uma vez pelo root da aplicação.

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

export type InstallPlatform = "android" | "ios" | "desktop" | "unknown";

export interface InstallSnapshot {
  /** Existe um prompt nativo pronto para ser usado */
  canPrompt: boolean;
  /** O app já está rodando instalado (standalone) */
  isStandalone: boolean;
  /** Plataforma detectada, usada para instruções manuais */
  platform: InstallPlatform;
  /** true quando o usuário já descartou o convite recentemente */
  dismissed: boolean;
}

const DISMISS_KEY = "cidadela:install-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 dias

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listening = false;
let snapshot: InstallSnapshot = {
  canPrompt: false,
  isStandalone: false,
  platform: "unknown",
  dismissed: false,
};

const listeners = new Set<(next: InstallSnapshot) => void>();

function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPad moderno se identifica como Mac, mas expõe touch
  if (/Macintosh/i.test(ua) && (navigator as { maxTouchPoints?: number }).maxTouchPoints) {
    return "ios";
  }
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return "desktop";
  return "unknown";
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}

function readDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function publish(patch: Partial<InstallSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener(snapshot);
}

function refresh() {
  publish({
    canPrompt: Boolean(deferredPrompt),
    isStandalone: isStandaloneMode(),
    platform: detectPlatform(),
    dismissed: readDismissed(),
  });
}

/** Liga os listeners globais. Idempotente — chame no boot da aplicação. */
export function captureInstallPrompt(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    publish({ canPrompt: true, dismissed: false });
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    publish({ canPrompt: false, isStandalone: true });
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
  });

  window
    .matchMedia?.("(display-mode: standalone)")
    ?.addEventListener?.("change", () => publish({ isStandalone: isStandaloneMode() }));

  refresh();
}

/**
 * Registra o service worker.
 *
 * Sem ele o Chrome não considera o app instalável e nunca dispara o
 * `beforeinstallprompt` — que é justamente o evento que o botão "Instalar"
 * depende. Em dev fica desligado para não servir assets velhos do cache.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("[pwa] service worker não registrado", error);
    });
  });
}

export function getInstallSnapshot(): InstallSnapshot {
  return snapshot;
}

export function subscribeInstall(listener: (next: InstallSnapshot) => void): () => void {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}

/** Atualiza o snapshot no cliente (SSR devolve um estado neutro). */
export function primeInstallSnapshot(): InstallSnapshot {
  if (typeof window !== "undefined") refresh();
  return snapshot;
}

/**
 * Abre o prompt nativo de instalação.
 * Retorna "unavailable" quando o navegador não ofereceu o prompt.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferredPrompt;
  if (!event) return "unavailable";
  deferredPrompt = null;
  publish({ canPrompt: false });
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome;
  } catch {
    return "unavailable";
  }
}

export function dismissInstallPrompt(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  publish({ dismissed: true });
}

export function resetInstallDismiss(): void {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    /* ignore */
  }
  publish({ dismissed: false });
}

export function installInstructions(platform: InstallPlatform): string[] {
  if (platform === "ios") {
    return [
      "Toque no botão Compartilhar do Safari (quadrado com a seta).",
      "Escolha “Adicionar à Tela de Início”.",
      "Confirme em “Adicionar” — o app aparece junto dos seus ícones.",
    ];
  }
  if (platform === "android") {
    return [
      "Abra o menu ⋮ do Chrome, no canto superior direito.",
      "Toque em “Instalar aplicativo” ou “Adicionar à tela inicial”.",
      "Confirme em “Instalar”.",
    ];
  }
  return [
    "Clique no ícone de instalação na barra de endereços do navegador.",
    "Ou abra o menu do navegador e escolha “Instalar Cardápio Cidadela”.",
    "Confirme em “Instalar”.",
  ];
}
