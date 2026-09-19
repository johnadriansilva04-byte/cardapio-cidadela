import { buildEnvelope, isKnownEvent, normalizePath, sanitizeProps } from "./events";
import type {
  AnalyticsConfig,
  AnalyticsEvent,
  AnalyticsEventName,
  AnalyticsProps,
  AnalyticsStatus,
} from "./types";

const OPT_OUT_KEY = "cidadela:analytics-optout";
const ANON_ID_KEY = "cidadela:analytics-anon";

const DEFAULTS = {
  flushAt: 20,
  flushIntervalMs: 10_000,
} as const;

function readEnvEndpoint(): string | undefined {
  try {
    // Vite injeta VITE_* em import.meta.env; fora do browser pode não existir.
    const env = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
    const v = env?.VITE_ANALYTICS_ENDPOINT;
    if (typeof v === "string" && v) return v;
  } catch {
    /* import.meta.env indisponível (SSR/node) */
  }
  return undefined;
}

/** Um id anônimo por dispositivo. Não identifica a pessoa, só agrupa a sessão. */
function readAnonId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(ANON_ID_KEY, id);
    return id;
  } catch {
    // Storage bloqueado: cai num id efêmero que vale só para este carregamento.
    return Math.random().toString(36).slice(2);
  }
}

function readOptOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(OPT_OUT_KEY) === "true";
  } catch {
    return false;
  }
}

function readDoNotTrack(): boolean {
  if (typeof navigator === "undefined") return false;
  const dnt =
    (navigator as Navigator & { doNotTrack?: string | null }).doNotTrack ??
    (navigator as unknown as { msDoNotTrack?: string | null }).msDoNotTrack;
  return dnt === "1" || dnt === "yes";
}

/**
 * Coletor de analytics sem dependência de fornecedor.
 *
 * - Não envia nada sem `endpoint` configurado (falha silenciosa, por design).
 * - Respeita `localStorage` de opt-out e o cabeçalho Do Not Track.
 * - Remove props com cara de dado pessoal antes de qualquer envio.
 * - Agrupa eventos e usa `sendBeacon` quando disponível, para não perder o
 *   último lote ao sair da página.
 */
export class AnalyticsClient {
  private readonly config: Required<Pick<AnalyticsConfig, "flushAt" | "flushIntervalMs">> &
    Pick<AnalyticsConfig, "endpoint" | "debug">;
  private queue: AnalyticsEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private anonId = "";

  constructor(config: AnalyticsConfig = {}) {
    this.config = {
      endpoint: config.endpoint ?? readEnvEndpoint(),
      debug: config.debug ?? false,
      flushAt: config.flushAt ?? DEFAULTS.flushAt,
      flushIntervalMs: config.flushIntervalMs ?? DEFAULTS.flushIntervalMs,
    };
  }

  status(): AnalyticsStatus {
    const doNotTrack = readDoNotTrack();
    const optedOut = readOptOut();
    const hasEndpoint = Boolean(this.config.endpoint);
    return {
      enabled: hasEndpoint && !optedOut && !doNotTrack,
      optedOut,
      doNotTrack,
      hasEndpoint,
    };
  }

  /** Liga/desliga o rastreamento deste dispositivo. Desligar limpa a fila. */
  setEnabled(enabled: boolean): void {
    if (typeof window === "undefined") return;
    try {
      if (enabled) window.localStorage.removeItem(OPT_OUT_KEY);
      else window.localStorage.setItem(OPT_OUT_KEY, "true");
    } catch {
      /* storage bloqueado */
    }
    if (!enabled) {
      this.queue = [];
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }
  }

  track(name: AnalyticsEventName, props: AnalyticsProps = {}): void {
    const status = this.status();
    if (!status.enabled) {
      if (this.config.debug && !isKnownEvent(name)) {
        console.warn(`[analytics] evento desconhecido: ${name}`);
      }
      return;
    }
    if (!isKnownEvent(name)) {
      if (this.config.debug) console.warn(`[analytics] evento desconhecido: ${name}`);
      return;
    }

    this.queue.push({
      name,
      props: sanitizeProps(props),
      at: Date.now(),
      anonId: this.anonId || (this.anonId = readAnonId()),
      path: typeof window !== "undefined" ? normalizePath(window.location.pathname) : "",
    });

    if (this.config.debug) console.debug(`[analytics] ${name}`, props);
    if (this.queue.length >= this.config.flushAt) void this.flush();
    else this.scheduleFlush();
  }

  /** Envia o lote pendente. Nunca lança — analytics não pode quebrar a UI. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0 || !this.config.endpoint) return;

    const batch = this.queue;
    this.queue = [];
    const { payload } = buildEnvelope(batch);

    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon(this.config.endpoint, blob)) return;
      }
      await fetch(this.config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    } catch (err) {
      if (this.config.debug) console.warn("[analytics] falha ao enviar", err);
    }
  }

  /** Quantidade de eventos ainda não enviados (útil em testes e debug). */
  get pending(): number {
    return this.queue.length;
  }

  private scheduleFlush(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.config.flushIntervalMs);
  }
}

/** Instância usada pela aplicação. Testes criam a própria instância. */
export const analytics = new AnalyticsClient();
