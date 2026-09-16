// Preferências locais da operação no celular.
// Tudo aqui é por dispositivo (o som do tablet do balcão não precisa tocar no
// celular do dono que está em casa), então localStorage é o lugar certo.

const KEYS = {
  sound: "cidadela:pref-sound",
  notifications: "cidadela:pref-notifications",
  keepAwake: "cidadela:pref-keep-awake",
  compactCards: "cidadela:pref-compact-cards",
} as const;

export interface MobilePreferences {
  /** Toca o alerta sonoro em pedido novo. */
  sound: boolean;
  /** Dispara notificação do sistema em pedido novo. */
  notifications: boolean;
  /** Mantém a tela ligada enquanto o painel está aberto. */
  keepAwake: boolean;
  /** Cards de pedido recolhidos por padrão. */
  compactCards: boolean;
}

export const DEFAULT_PREFERENCES: MobilePreferences = {
  sound: true,
  notifications: true,
  keepAwake: false,
  compactCards: true,
};

const PREFERENCE_EVENT = "cidadela:preferences-changed";

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch {
    return fallback;
  }
}

export function loadPreferences(): MobilePreferences {
  return {
    sound: readBool(KEYS.sound, DEFAULT_PREFERENCES.sound),
    notifications: readBool(KEYS.notifications, DEFAULT_PREFERENCES.notifications),
    keepAwake: readBool(KEYS.keepAwake, DEFAULT_PREFERENCES.keepAwake),
    compactCards: readBool(KEYS.compactCards, DEFAULT_PREFERENCES.compactCards),
  };
}

export function savePreference<K extends keyof MobilePreferences>(
  key: K,
  value: MobilePreferences[K],
): void {
  try {
    localStorage.setItem(KEYS[key], String(value));
  } catch {
    /* storage bloqueado — a preferência vale só para esta sessão */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PREFERENCE_EVENT, { detail: loadPreferences() }));
  }
}

export function subscribePreferences(listener: (next: MobilePreferences) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener(loadPreferences());
  window.addEventListener("storage", handler);
  window.addEventListener(PREFERENCE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(PREFERENCE_EVENT, handler);
  };
}

export type NotificationPermissionState = "unsupported" | "default" | "granted" | "denied";

export function notificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Pede permissão e devolve o resultado — sem exceção quando o navegador bloqueia. */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Mostra uma notificação do sistema, respeitando a preferência e a permissão. */
export function notifyNewOrder(title: string, body: string, onClick?: () => void): boolean {
  if (!loadPreferences().notifications) return false;
  if (notificationPermission() !== "granted") return false;
  try {
    const n = new Notification(title, { body, icon: "/icon-192.png", tag: "cidadela-order" });
    if (onClick) {
      n.onclick = () => {
        window.focus();
        onClick();
        n.close();
      };
    }
    return true;
  } catch {
    return false;
  }
}
