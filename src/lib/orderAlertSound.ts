// Alerta sonoro grave e ALTO para novos pedidos.
// Web Audio API — sem arquivo externo — funciona offline.
// O AudioContext so pode iniciar depois de um gesto do usuário —
// registramos um unlock global no primeiro pointerdown/touch/keydown.

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
    getAudioContext();
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}

export function playNewOrderAlert() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(1.2, t + 0.02);
  master.gain.setValueAtTime(1.2, t +0.28);
  master.gain.exponentialRampToValueAtTime(0.0001, t +1.6);
  master.connect(ctx.destination);

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 240;
  lowpass.connect(master);

  const PULSES = [
    { at: 0, freq: 120 },
    { at: 0.32, freq:  80 },
    { at: 0.64, freq:  50 },
  ] as const;

  for (const pulse of PULSES) {
    const start = t + pulse.at;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(pulse.freq, start);
    osc.frequency.exponentialRampToValueAtTime(45, start +0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(1.0, start +0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start +0.28);
    osc.connect(g);
    g.connect(lowpass);
    osc.start(start);
    osc.stop(start +0.3);
  }
}

registerUnlockOnce();