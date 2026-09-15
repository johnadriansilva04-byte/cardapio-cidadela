// Alerta sonoro grave e ALTO para novos pedidos.
// Web Audio API — sem arquivo externo — funciona offline.
// O AudioContext so pode iniciar depois de um gesto do usuário —
// registramos um unlock global no primeiro pointerdown/touch/keydown.

import { loadPreferences } from "@/modules/mobile/preferences";

let audioCtx: AudioContext | null = null;
let unlockRegistered = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

function registerUnlockOnce() {
  if (unlockRegistered || typeof window === "undefined") return;
  unlockRegistered = true;
  const unlock = () => {
    const c = getAudioContext();
    if (c?.state === "suspended") void c.resume();
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (audioCtx?.state === "suspended") void audioCtx.resume();
    }
  });
}

export function requestOrderNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (!loadPreferences().notifications) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

/** Diz se o alerta sonoro está ligado nas preferências do dispositivo. */
export function isOrderAlertEnabled(): boolean {
  return loadPreferences().sound;
}

function fallbackBeep() {
  try {
    const a = new Audio(
      "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==",
    );
    a.volume = 1;
    void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

export function playNewOrderAlert() {
  // Preferência por dispositivo — quem opera no balcão pode desligar o som.
  if (!loadPreferences().sound) return;

  // vibração em mobile
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([220, 80, 220, 80, 320]);
    }
  } catch {
    /* ignore */
  }

  const ctx = getAudioContext();
  if (!ctx) {
    fallbackBeep();
    return;
  }
  // Se ainda suspenso (sem gesto), tenta fallback audível
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => fallbackBeep());
    // tenta tocar mesmo suspenso — alguns browsers ainda tocam baixo
  }
  const t = ctx.currentTime;

  try {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(1.35, t + 0.02);
    master.gain.setValueAtTime(1.35, t + 0.32);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    master.connect(ctx.destination);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 420;
    lowpass.connect(master);

    // grave pulsante + camada aguda estridente pra cortar o ambiente
    const PULSES = [
      { at: 0, freq: 165, type: "sawtooth" as const, gain: 1.0 },
      { at: 0.34, freq: 110, type: "sawtooth" as const, gain: 0.95 },
      { at: 0.68, freq: 82, type: "square" as const, gain: 1.0 },
      { at: 0.96, freq: 165, type: "square" as const, gain: 0.9 },
    ];

    for (const pulse of PULSES) {
      const start = t + pulse.at;
      const osc = ctx.createOscillator();
      osc.type = pulse.type;
      osc.frequency.setValueAtTime(pulse.freq, start);
      osc.frequency.exponentialRampToValueAtTime(pulse.freq * 0.55, start + 0.22);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(pulse.gain, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(g);
      g.connect(lowpass);
      osc.start(start);
      osc.stop(start + 0.32);
    }

    // camada aguda tipo "ding-ding" por cima (sine 880hz)
    for (const at of [0.02, 0.36, 0.7, 0.98]) {
      const start = t + at;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 880;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.55, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(g);
      g.connect(master);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  } catch {
    fallbackBeep();
  }
}

registerUnlockOnce();