// Alerta sonoro ALTO e insistente para novos pedidos.
// Web Audio API — sem arquivo externo — funciona offline.
// O AudioContext so pode iniciar depois de um gesto do usuario —
// registramos um unlock global no primeiro pointerdown/touch/keydown.
//
// Cadeia de ganho pensada para o alto-falante de celular no balcao:
// - tres rodadas completas da sirene, com pausa curta entre elas;
// - rajadas longas com intervalo curto: o som fica quase continuo, e som
//   continuo soa mais alto que bipes espacados;
// - highpass em 500Hz antes da saturacao: o speaker de celular nao reproduz
//   grave util, entao cortar essa banda libera headroom para o que se ouve;
// - saturacao forte (waveshaper + limiter) empurra o sinal para o teto de
//   amplitude, maximizando o RMS — que e o que define "volume" percebido.

import { loadPreferences } from "@/modules/mobile/preferences";

const STEP = 0.09;

// Uma rodada da sirene: rajadas longas com intervalo curto — o som fica
// praticamente continuo, o que soa muito mais alto que bipes espaçados.
const BURST_COUNT = 3;
const BURST_PERIOD = 1.28;
const BURST_LENGTH = 1.16;
const CLOSING_LENGTH = 0.6;
const CYCLE_LENGTH = BURST_COUNT * BURST_PERIOD + CLOSING_LENGTH;

// Tres rodadas: o alerta dura o suficiente para ser notado mesmo no barulho
// da cozinha, e nao passa tanto tempo a ponto de virar incomodo.
const CYCLE_COUNT = 3;
const CYCLE_GAP = 0.5;
const ALERT_SECONDS = CYCLE_COUNT * CYCLE_LENGTH + (CYCLE_COUNT - 1) * CYCLE_GAP;

// Volumes de pico. O master alto + saturação forte empurram o sinal para o
// teto do limiter: o RMS (volume percebido) sobe junto.
const MASTER_LEVEL = 1.8;
const DRIVE = 4;

let audioCtx: AudioContext | null = null;
let unlockRegistered = false;
let current: { master: GainNode; oscillators: OscillatorNode[]; timer: number | null } | null =
  null;

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

/** Diz se o alerta sonoro esta ligado nas preferencias do dispositivo. */
export function isOrderAlertEnabled(): boolean {
  return loadPreferences().sound;
}

function softClipCurve(drive: number): Float32Array<ArrayBuffer> {
  const size = 1024;
  const curve = new Float32Array(new ArrayBuffer(size * 4));
  const norm = Math.tanh(drive);
  for (let i = 0; i < size; i += 1) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / norm;
  }
  return curve;
}

/** Beep de emergencia (Web Audio indisponivel), montado em memoria. */
function fallbackBeep() {
  try {
    const sampleRate = 8000;
    const beepSeconds = 0.62;
    const pauseSeconds = 0.06;
    const repeats = 14;
    const total = Math.round(sampleRate * (beepSeconds + pauseSeconds) * repeats);
    const samples = new Int16Array(total);
    for (let i = 0; i < total; i += 1) {
      const seconds = i / sampleRate;
      const inBeep = seconds % (beepSeconds + pauseSeconds) < beepSeconds;
      // onda quadrada em 1350Hz: mais energia audivel que a senoide no speaker
      // pequeno, e a amplitude vai ao teto do int16 para maximizar o volume.
      const tone = Math.sin(2 * Math.PI * 1350 * seconds) >= 0 ? 1 : -1;
      samples[i] = inBeep ? tone * 32767 : 0;
    }
    const bytes = new Uint8Array(44 + samples.length * 2);
    const view = new DataView(bytes.buffer);
    const writeStr = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i += 1) {
      view.setInt16(44 + i * 2, samples[i], true);
    }
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    const audio = new Audio(`data:audio/wav;base64,${btoa(binary)}`);
    audio.volume = 1;
    void audio.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Interrompe a sirene em andamento (alertas seguidos nao se sobrepoem). */
export function stopOrderAlert() {
  if (!current) return;
  const { master, oscillators, timer } = current;
  current = null;
  if (timer !== null) window.clearTimeout(timer);
  try {
    const ctx = audioCtx;
    if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
    }
    for (const osc of oscillators) {
      try {
        osc.stop();
      } catch {
        /* ja parado */
      }
    }
  } catch {
    /* ignore */
  }
}

function scheduleChirp(
  ctx: AudioContext,
  oscillators: OscillatorNode[],
  target: AudioNode,
  start: number,
  length: number,
  low: number,
  high: number,
  level: number,
  type: OscillatorType = "sawtooth",
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(low, start);
  for (let t = start + STEP; t < start + length; t += STEP) {
    const index = Math.round((t - start) / STEP);
    osc.frequency.setValueAtTime(index % 2 === 0 ? high : low, t);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(level, start + 0.008);
  g.gain.setValueAtTime(level, start + length - 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(g);
  g.connect(target);
  osc.start(start);
  osc.stop(start + length + 0.02);
  oscillators.push(osc);
}

export function playNewOrderAlert(options?: { force?: boolean }) {
  // Preferencia por dispositivo — quem opera no balcao pode desligar o som.
  if (!options?.force && !loadPreferences().sound) return;

  // vibracao em mobile — acompanha as rodadas da sirene
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([400, 90, 400, 90, 400, 250, 400, 90, 400, 90, 400, 250, 400, 90, 600]);
    }
  } catch {
    /* ignore */
  }

  const ctx = getAudioContext();
  if (!ctx) {
    fallbackBeep();
    return;
  }

  // O agendamento so vale depois do contexto estar rodando: se o navegador
  // ainda bloqueia o audio, agendar agora produziria silencio.
  if (ctx.state === "suspended") {
    ctx
      .resume()
      .then(() => scheduleAlert(ctx))
      .catch(() => fallbackBeep());
    return;
  }

  scheduleAlert(ctx);
}

function scheduleAlert(ctx: AudioContext) {
  stopOrderAlert();

  const t = ctx.currentTime + 0.02;

  try {
    const master = ctx.createGain();
    master.gain.setValueAtTime(MASTER_LEVEL, t);
    master.gain.setValueAtTime(MASTER_LEVEL, t + ALERT_SECONDS - 0.08);
    master.gain.exponentialRampToValueAtTime(0.0001, t + ALERT_SECONDS);

    // Corta o grave que o speaker de celular nao reproduz: sobra headroom
    // para a banda audivel, que passa a saturar mais alto.
    const rumbleCut = ctx.createBiquadFilter();
    rumbleCut.type = "highpass";
    rumbleCut.frequency.value = 500;
    rumbleCut.Q.value = 0.7;

    const shaper = ctx.createWaveShaper();
    shaper.curve = softClipCurve(DRIVE);
    shaper.oversample = "4x";

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.18;

    const bright = ctx.createBiquadFilter();
    bright.type = "peaking";
    bright.frequency.value = 2200;
    bright.Q.value = 0.9;
    bright.gain.value = 7;

    master.connect(rumbleCut);
    rumbleCut.connect(shaper);
    shaper.connect(limiter);
    limiter.connect(bright);
    bright.connect(ctx.destination);

    const oscillators: OscillatorNode[] = [];

    for (let cycle = 0; cycle < CYCLE_COUNT; cycle += 1) {
      const cycleStart = t + cycle * (CYCLE_LENGTH + CYCLE_GAP);

      for (let burst = 0; burst < BURST_COUNT; burst += 1) {
        const start = cycleStart + burst * BURST_PERIOD;

        // sirene de dois tons alternados — o grosso do volume
        scheduleChirp(ctx, oscillators, master, start, BURST_LENGTH, 1000, 1620, 2.1);

        // camada uma oitava acima: junto com a saturacao, corta o ruido da cozinha
        scheduleChirp(ctx, oscillators, master, start, BURST_LENGTH, 2000, 2400, 1.2, "square");
      }

      // tom de fechamento, garante que cada rodada "termine" audivel
      const closingStart = cycleStart + BURST_COUNT * BURST_PERIOD;
      scheduleChirp(ctx, oscillators, master, closingStart, CLOSING_LENGTH, 1900, 1900, 1.5);
    }

    const timer = window.setTimeout(
      () => {
        if (current?.master === master) current = null;
      },
      (ALERT_SECONDS + 0.3) * 1000,
    );

    current = { master, oscillators, timer };
  } catch {
    fallbackBeep();
  }
}

/** Previa do alerta, disparada pelo usuario ao ajustar as preferencias. */
export function previewOrderAlert() {
  playNewOrderAlert({ force: true });
}

registerUnlockOnce();
