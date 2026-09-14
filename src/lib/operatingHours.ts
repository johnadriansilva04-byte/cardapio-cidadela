// Horário de funcionamento — por dia da semana
export type DayKey = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";

export interface DaySchedule {
  closed: boolean;
  open: string; // "HH:MM"
  close: string; // "HH:MM" - pode ser menor que open = vira a madrugada
}

export type OperatingHours = Record<DayKey, DaySchedule>;

export const DAY_ORDER: DayKey[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

export const DAY_LABEL: Record<DayKey, { label: string; short: string; dow: number }> = {
  seg: { label: "Segunda-feira", short: "SEG", dow: 1 },
  ter: { label: "Terça-feira", short: "TER", dow: 2 },
  qua: { label: "Quarta-feira", short: "QUA", dow: 3 },
  qui: { label: "Quinta-feira", short: "QUI", dow: 4 },
  sex: { label: "Sexta-feira", short: "SEX", dow: 5 },
  sab: { label: "Sábado", short: "SÁB", dow: 6 },
  dom: { label: "Domingo", short: "DOM", dow: 0 },
};

const DOW_TO_KEY: Record<number, DayKey> = {
  0: "dom",
  1: "seg",
  2: "ter",
  3: "qua",
  4: "qui",
  5: "sex",
  6: "sab",
};

// Default: 17:00 — 00:00 todos os dias aberto
export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  seg: { closed: false, open: "17:00", close: "00:00" },
  ter: { closed: false, open: "17:00", close: "00:00" },
  qua: { closed: false, open: "17:00", close: "00:00" },
  qui: { closed: false, open: "17:00", close: "00:00" },
  sex: { closed: false, open: "17:00", close: "00:00" },
  sab: { closed: false, open: "17:00", close: "00:00" },
  dom: { closed: false, open: "17:00", close: "00:00" },
};

export function normalizeOperatingHours(raw: unknown): OperatingHours {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_OPERATING_HOURS };
  const out: OperatingHours = { ...DEFAULT_OPERATING_HOURS } as OperatingHours;
  for (const k of DAY_ORDER) {
    const v = (raw as Record<string, unknown>)[k] as Partial<DaySchedule> | undefined;
    if (v && typeof v === "object") {
      const open = typeof v.open === "string" && /^\d{1,2}:\d{2}$/.test(v.open) ? v.open.padStart(5, "0") : out[k].open;
      const close = typeof v.close === "string" && /^\d{1,2}:\d{2}$/.test(v.close) ? v.close.padStart(5, "0") : out[k].close;
      const closed = typeof v.closed === "boolean" ? v.closed : false;
      out[k] = { closed, open, close };
    }
  }
  return out;
}

export function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const hh = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 0;
  const mm = Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0;
  return hh * 60 + mm;
}

export function formatTime(hhmm: string): string {
  return hhmm.slice(0, 5);
}

export function formatRange(s: DaySchedule): string {
  if (s.closed) return "Fechado";
  if (s.open === s.close) return `${s.open} — 24h`;
  return `${s.open} — ${s.close}`;
}

// Verifica se agora está aberto — considera virada de madrugada (close < open)
export function isOpenNow(hours: OperatingHours | null | undefined, now = new Date()): boolean {
  if (!hours) return true; // sem config = sempre aberto
  const normalized = normalizeOperatingHours(hours);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayKey = DOW_TO_KEY[now.getDay()];
  const today = normalized[todayKey];

  // Hoje
  if (!today.closed) {
    const o = parseMinutes(today.open);
    const c = parseMinutes(today.close);
    if (c === o) return true; // 24h
    if (c > o) {
      if (nowMin >= o && nowMin < c) return true;
    } else {
      // vira madrugada: hoje aberto de o até 24h
      if (nowMin >= o) return true;
    }
  }

  // Ontem — pode ainda estar dentro do horário que virou
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yKey = DOW_TO_KEY[yesterday.getDay()];
  const y = normalized[yKey];
  if (!y.closed) {
    const o = parseMinutes(y.open);
    const c = parseMinutes(y.close);
    if (c !== o && c < o) {
      // aberto de ontem até c hoje de madrugada
      if (nowMin < c) return true;
    }
  }

  return false;
}

export function getTodaySchedule(hours: OperatingHours | null | undefined, now = new Date()): { key: DayKey; schedule: DaySchedule } {
  const normalized = normalizeOperatingHours(hours);
  const key = DOW_TO_KEY[now.getDay()];
  return { key, schedule: normalized[key] };
}

export function getNextOpenInfo(hours: OperatingHours | null | undefined, now = new Date()): { label: string; time: string } | null {
  if (!hours) return null;
  const normalized = normalizeOperatingHours(hours);
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    const key = DOW_TO_KEY[d.getDay()];
    const s = normalized[key];
    if (s.closed) continue;
    // se é hoje, só conta como próximo se ainda não abriu ou já fechou
    if (offset === 0) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const o = parseMinutes(s.open);
      const c = parseMinutes(s.close);
      const open = isOpenNow(normalized, now);
      if (open) return null; // já aberto
      // se ainda vai abrir hoje e horário de abertura é futuro
      if (c > o) {
        if (nowMin < o) return { label: DAY_LABEL[key].label, time: s.open };
        else continue; // já passou hoje
      } else {
        // vira madrugada — se já passou de c (que é madrugada) e ainda não é o
        // então a abertura de hoje já passou ou é mais tarde
        if (nowMin < o) return { label: DAY_LABEL[key].label, time: s.open };
        else continue;
      }
    } else {
      return { label: DAY_LABEL[key].label, time: s.open };
    }
  }
  return null;
}

export function getClosesAt(hours: OperatingHours | null | undefined, now = new Date()): string | null {
  if (!hours) return null;
  const normalized = normalizeOperatingHours(hours);
  // se aberto por causa de ontem, fecha hoje no horário de ontem
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yKey = DOW_TO_KEY[yesterday.getDay()];
  const y = normalized[yKey];
  if (!y.closed) {
    const c = parseMinutes(y.close);
    const o = parseMinutes(y.open);
    if (c < o && nowMin < c) return y.close; // ainda no dia anterior
  }
  const todayKey = DOW_TO_KEY[now.getDay()];
  const today = normalized[todayKey];
  if (!today.closed) return today.close;
  return null;
}

// Para salvar no DB — garante HH:MM com zero à esquerda
export function serializeHours(hours: OperatingHours): OperatingHours {
  const out: OperatingHours = {} as OperatingHours;
  for (const k of DAY_ORDER) {
    const s = hours[k];
    const open = s.open.padStart(5, "0");
    const close = s.close.padStart(5, "0");
    out[k] = { closed: s.closed, open, close };
  }
  return out;
}
