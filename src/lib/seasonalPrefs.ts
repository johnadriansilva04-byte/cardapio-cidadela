/**
 * Preferências dos temas sazonais, por loja e por dispositivo.
 *
 * O Pracinha avisa o dono no mês do evento ("O Carnaval chegou — quer vestir o
 * cardápio?") e oferece adotar o tema com um toque. Isto aqui guarda o que o
 * dono já decidiu para não avisar de novo: o que ele adotou, o que dispensou e
 * se ele não quer mais receber esses avisos.
 *
 * É por dispositivo (localStorage), como o resto das preferências de operação:
 * o aviso aparece no painel que o dono abre, não numa conta compartilhada.
 */

import type { ThemeKey } from "./seasonalThemes";

const KEY = "cidadela:seasonal-prefs";

export interface SeasonalPrefs {
  /** `false` quando o dono desliga os avisos sazonais de vez. */
  enabled: boolean;
  /** Temas que o dono já adotou (não oferecer de novo). */
  adopted: ThemeKey[];
  /**
   * Temas que o dono dispensou, com o carimbo do ano em que dispensou — o
   * mesmo tema volta a ser oferecido no ano seguinte.
   */
  dismissed: Partial<Record<ThemeKey, number>>;
}

/**
 * Padrões novos a cada chamada.
 *
 * Não use um objeto constante com `{ ...DEFAULTS }`: a cópia é rasa, então
 * `adopted`/`dismissed` continuariam sendo os MESMOS arrays/objetos, e um
 * `markThemeDismissed` mutaria o padrão global — vazando decisão de um
 * dispositivo (ou de um teste) para o outro.
 */
function defaults(): SeasonalPrefs {
  return { enabled: true, adopted: [], dismissed: {} };
}

function readStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Lê as preferências; devolve o padrão quando não há nada ou está corrompido. */
export function loadSeasonalPrefs(): SeasonalPrefs {
  const storage = readStorage();
  if (!storage) return defaults();
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<SeasonalPrefs>;
    return {
      enabled: parsed.enabled !== false,
      adopted: Array.isArray(parsed.adopted) ? parsed.adopted : [],
      dismissed: parsed.dismissed && typeof parsed.dismissed === "object" ? parsed.dismissed : {},
    };
  } catch {
    return defaults();
  }
}

function write(prefs: SeasonalPrefs): void {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage cheio/bloqueado — a decisão vale só para esta sessão */
  }
}

/** Marca um tema como adotado (o dono vestiu o cardápio com ele). */
export function markThemeAdopted(key: ThemeKey): SeasonalPrefs {
  const prefs = loadSeasonalPrefs();
  if (!prefs.adopted.includes(key)) prefs.adopted.push(key);
  // Adotar desfaz a dispensa do ano.
  delete prefs.dismissed[key];
  write(prefs);
  return prefs;
}

/** Marca um tema como dispensado no ano dado (volta a ser oferecido no ano seguinte). */
export function markThemeDismissed(key: ThemeKey, year: number): SeasonalPrefs {
  const prefs = loadSeasonalPrefs();
  prefs.dismissed[key] = year;
  write(prefs);
  return prefs;
}

/** Liga/desliga os avisos sazonais. */
export function setSeasonalEnabled(enabled: boolean): SeasonalPrefs {
  const prefs = loadSeasonalPrefs();
  prefs.enabled = enabled;
  write(prefs);
  return prefs;
}

/**
 * O tema deve ser oferecido agora? Regra: avisos ligados, tema ainda não
 * adotado e não dispensado NESTE ano.
 */
export function shouldOfferTheme(
  key: ThemeKey,
  year: number,
  prefs: SeasonalPrefs = loadSeasonalPrefs(),
): boolean {
  if (!prefs.enabled) return false;
  if (prefs.adopted.includes(key)) return false;
  return prefs.dismissed[key] !== year;
}
