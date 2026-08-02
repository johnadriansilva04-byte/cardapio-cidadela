/**
 * Trilha sonora tática sintetizada (WebAudio) — sem assets externos.
 * Passos na lama, estalo de madeira, rádio transmissor, sirene de vitória.
 */

type Sfx = "place" | "move" | "mill" | "capture" | "select" | "invalid" | "victory" | "defeat" | "radio";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setSfxEnabled(value: boolean) {
  enabled = value;
  if (master) master.gain.value = value ? 0.5 : 0;
}

export function isSfxEnabled() {
  return enabled;
}

function noise(duration: number, filterFreq: number, gain: number, type: BiquadFilterType = "lowpass") {
  const ac = ensure();
  if (!ac || !master) return;
  const frames = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(master);
  src.start();
}

function tone(freq: number, duration: number, gain = 0.18, type: OscillatorType = "sine", slideTo?: number) {
  const ac = ensure();
  if (!ac || !master) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + duration);
  g.gain.setValueAtTime(0.0001, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(g).connect(master);
  osc.start();
  osc.stop(ac.currentTime + duration + 0.05);
}

export function playSfx(kind: Sfx) {
  if (!enabled) return;
  switch (kind) {
    case "select":
      tone(520, 0.06, 0.08, "triangle");
      break;
    case "place":
      // estalo seco de madeira sobre a mesa
      noise(0.09, 2600, 0.35, "bandpass");
      tone(180, 0.09, 0.12, "square");
      break;
    case "move":
      // passos na lama
      noise(0.18, 700, 0.3);
      tone(120, 0.12, 0.07, "sine");
      break;
    case "mill":
      tone(523, 0.12, 0.14, "triangle");
      window.setTimeout(() => tone(659, 0.14, 0.14, "triangle"), 90);
      window.setTimeout(() => tone(784, 0.22, 0.16, "triangle"), 190);
      break;
    case "capture":
      noise(0.3, 1200, 0.4, "highpass");
      tone(220, 0.28, 0.16, "sawtooth", 70);
      break;
    case "invalid":
      tone(150, 0.16, 0.14, "square", 90);
      break;
    case "radio":
      noise(0.22, 1800, 0.18, "bandpass");
      tone(880, 0.05, 0.06, "square");
      break;
    case "victory":
      [523, 659, 784, 1046].forEach((f, i) =>
        window.setTimeout(() => tone(f, 0.3, 0.16, "triangle"), i * 130),
      );
      break;
    case "defeat":
      [392, 349, 294, 220].forEach((f, i) =>
        window.setTimeout(() => tone(f, 0.38, 0.15, "sine"), i * 170),
      );
      break;
  }
}
