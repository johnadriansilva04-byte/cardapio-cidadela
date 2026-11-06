/**
 * Temas sazonais e personalizações por data comemorativa.
 *
 * A ideia: o cardápio se veste sozinho na data. O dono não configura nada — o
 * tema do Natal, do Carnaval, da Festa Junina ou da Independência entra pela
 * DATA (e sai quando a janela fecha). É o mesmo espírito do `seasonal.ts`, mas
 * com o catálogo inteiro de feriados brasileiros e a combinação
 * nicho × data ("Natal na Pizzaria", "Carnaval do Hamburguer").
 *
 * Tudo aqui é PURO e determinístico (recebe `Date`, devolve dado): dá para
 * testar sem relógio falso, e o cardápio público, a landing e o wizard leem o
 * mesmo catálogo. As datas MÓVEIS (Carnaval, Páscoa, Corpus Christi) saem do
 * cálculo da Páscoa (Meeus/Jones/Butcher) — não podem ser fixas no calendário.
 */

export type ThemeKey =
  | "ano-novo"
  | "carnaval"
  | "trabalhador"
  | "pascoa"
  | "maes"
  | "namorados"
  | "festa-junina"
  | "pais"
  | "independencia"
  | "criancas"
  | "halloween"
  | "black-friday"
  | "natal";

export interface SeasonalTheme {
  key: ThemeKey;
  /** Nome curto: "Natal", "Carnaval". */
  name: string;
  emoji: string;
  /** Cores que o cardápio veste na janela (viram `primary_color`/`secondary_color`). */
  primary: string;
  secondary: string;
  /** Chamada de venda (landing/CTA). */
  headline: string;
  /** Sugestões de item/oferta que a IA oferece junto do tema. */
  menuIdeas: string[];
  /**
   * Desempate quando duas janelas se sobrepõem (ex.: Natal e Black Friday em
   * novembro). Maior vence.
   */
  priority: number;
  /** A data cai na janela do tema? */
  inWindow: (date: Date) => boolean;
}

// ──────────────────────────────────────────────────────────────
// Datas móveis — a Páscoa manda em Carnaval, Corpus Christi e Páscoa
// ──────────────────────────────────────────────────────────────

/**
 * Domingo de Páscoa do ano (Meeus/Jones/Butcher). Datas móveis do calendário
 * brasileiro derivam dela: Carnaval = Páscoa − 47 dias, por exemplo.
 */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Soma dias a uma data (meia-noite local), devolvendo uma nova data. */
function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/** A data está entre `from` e `to`, inclusive, ignorando a hora. */
function between(date: Date, from: Date, to: Date): boolean {
  const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return t >= a && t <= b;
}

/** Janela recorrente por mês/dia, tratando a virada do ano (ex.: 26/dez → 6/jan). */
function monthDayWindow(date: Date, from: [number, number], to: [number, number]): boolean {
  const year = date.getFullYear();
  const [fm, fd] = from;
  const [tm, td] = to;
  if (fm <= tm) {
    // Janela dentro do mesmo ano (mesmo mês ou meses crescentes).
    return between(date, new Date(year, fm, fd), new Date(year, tm, td));
  }
  // Cruza o ano: pode ser a janela que começou neste ano ou a do ano passado.
  return (
    between(date, new Date(year, fm, fd), new Date(year + 1, tm, td)) ||
    between(date, new Date(year - 1, fm, fd), new Date(year, tm, td))
  );
}

/** n-ésimo domingo de um mês (1-based). Usado por Dia das Mães/Pais. */
function nthSunday(year: number, month: number, n: number): Date {
  const first = new Date(year, month, 1);
  const offset = (7 - first.getDay()) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

/** Última sexta-feira de um mês (Black Friday). */
function lastFriday(year: number, month: number): Date {
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() + 2) % 7; // sexta = 5 → recua até a última sexta
  return new Date(year, month + 1, 0 - offset);
}

// ──────────────────────────────────────────────────────────────
// Catálogo de temas
// ──────────────────────────────────────────────────────────────

export const SEASONAL_THEMES: SeasonalTheme[] = [
  {
    key: "ano-novo",
    name: "Réveillon",
    emoji: "🥂",
    primary: "#facc15",
    secondary: "#f8fafc",
    headline: "Comece o ano vendendo mais",
    menuIdeas: ["Combo Réveillon", "Espumante / bebida gelada", "Prato da virada"],
    priority: 60,
    inWindow: (d) => monthDayWindow(d, [11, 26], [0, 6]),
  },
  {
    key: "carnaval",
    name: "Carnaval",
    emoji: "🎭",
    primary: "#a855f7",
    secondary: "#f59e0b",
    headline: "Carnaval é o pico do pedido na rua",
    menuIdeas: ["Combo Bloco", "Bebida gelada", "Porção pra dividir"],
    priority: 90,
    inWindow: (d) => {
      const e = easterSunday(d.getFullYear());
      return between(d, addDays(e, -51), addDays(e, -46)); // sábado → quarta de cinzas
    },
  },
  {
    key: "trabalhador",
    name: "Dia do Trabalhador",
    emoji: "🛠️",
    primary: "#ef4444",
    secondary: "#1f2937",
    headline: "Feriado de 1º de maio, cozinha aberta",
    menuIdeas: ["Almoço do feriado", "Combo família"],
    priority: 40,
    inWindow: (d) => monthDayWindow(d, [3, 25], [4, 1]),
  },
  {
    key: "pascoa",
    name: "Páscoa",
    emoji: "🐣",
    primary: "#a78bfa",
    secondary: "#fbbf24",
    headline: "Páscoa pede doce e sobremesa",
    menuIdeas: ["Sobremesa de Páscoa", "Ovo de colher", "Combo família"],
    priority: 70,
    inWindow: (d) => {
      const e = easterSunday(d.getFullYear());
      return between(d, addDays(e, -7), e); // Semana Santa
    },
  },
  {
    key: "maes",
    name: "Dia das Mães",
    emoji: "💐",
    primary: "#ec4899",
    secondary: "#f472b6",
    headline: "Dia das Mães: almoço em família",
    menuIdeas: ["Almoço em família", "Sobremesa especial", "Combo pra presente"],
    priority: 80,
    inWindow: (d) => {
      const sunday = nthSunday(d.getFullYear(), 4, 2); // 2º domingo de maio
      return between(d, addDays(sunday, -3), sunday);
    },
  },
  {
    key: "namorados",
    name: "Dia dos Namorados",
    emoji: "💞",
    primary: "#e11d48",
    secondary: "#fb7185",
    headline: "12 de junho: jantar a dois",
    menuIdeas: ["Combo para dois", "Sobremesa romântica", "Mesa reservada"],
    priority: 65,
    inWindow: (d) => monthDayWindow(d, [5, 6], [5, 12]),
  },
  {
    key: "festa-junina",
    name: "Festa Junina",
    emoji: "🌽",
    primary: "#f97316",
    secondary: "#eab308",
    headline: "Arraiá é o mês inteiro de junho",
    menuIdeas: ["Combo Arraiá", "Milho / pamonha", "Quentão sem álcool"],
    priority: 55,
    inWindow: (d) => monthDayWindow(d, [5, 13], [5, 30]),
  },
  {
    key: "pais",
    name: "Dia dos Pais",
    emoji: "👔",
    primary: "#2563eb",
    secondary: "#38bdf8",
    headline: "Dia dos Pais: churrasco e família",
    menuIdeas: ["Combo churrasco", "Porção especial", "Cerveja gelada"],
    priority: 80,
    inWindow: (d) => {
      const sunday = nthSunday(d.getFullYear(), 7, 2); // 2º domingo de agosto
      return between(d, addDays(sunday, -3), sunday);
    },
  },
  {
    key: "independencia",
    name: "Independência",
    emoji: "🇧🇷",
    primary: "#16a34a",
    secondary: "#facc15",
    headline: "7 de Setembro: feriado verde e amarelo",
    menuIdeas: ["Combo Brasil", "Churrasco do feriado", "Promo verde-amarela"],
    priority: 50,
    inWindow: (d) => monthDayWindow(d, [8, 1], [8, 7]),
  },
  {
    key: "criancas",
    name: "Dia das Crianças",
    emoji: "🧸",
    primary: "#f43f5e",
    secondary: "#38bdf8",
    headline: "12 de outubro: combo infantil",
    menuIdeas: ["Combo infantil", "Brinde surpresa", "Sobremesa colorida"],
    priority: 50,
    inWindow: (d) => monthDayWindow(d, [9, 1], [9, 12]),
  },
  {
    key: "halloween",
    name: "Halloween",
    emoji: "🎃",
    primary: "#f97316",
    secondary: "#7c3aed",
    headline: "31 de outubro: a noite mais assustadora",
    menuIdeas: ["Combo monstro", "Burger assustador", "Bebida temática"],
    priority: 60,
    inWindow: (d) => monthDayWindow(d, [9, 24], [9, 31]),
  },
  {
    key: "black-friday",
    name: "Black Friday",
    emoji: "🖤",
    primary: "#111827",
    secondary: "#facc15",
    headline: "Black Friday: a maior promoção do ano",
    menuIdeas: ["Oferta relâmpago", "Combo com desconto", "Destaque do dia"],
    priority: 75,
    inWindow: (d) => {
      const friday = lastFriday(d.getFullYear(), 10); // última sexta de novembro
      return between(d, friday, addDays(friday, 3)); // sexta → segunda
    },
  },
  {
    key: "natal",
    name: "Natal",
    emoji: "🎄",
    primary: "#dc2626",
    secondary: "#16a34a",
    headline: "O Natal é o pico do delivery",
    menuIdeas: ["Ceia de Natal", "Combo festivo", "Sobremesa natalina", "Kit presente"],
    priority: 100,
    inWindow: (d) => monthDayWindow(d, [10, 15], [11, 25]),
  },
];

/** Temas ativos na data, do mais forte para o mais fraco (desempate por `priority`). */
export function getActiveThemes(date: Date = new Date()): SeasonalTheme[] {
  return SEASONAL_THEMES.filter((t) => t.inWindow(date)).sort((a, b) => b.priority - a.priority);
}

/** O tema que manda no cardápio agora (ou `null` fora de qualquer janela). */
export function getPrimaryTheme(date: Date = new Date()): SeasonalTheme | null {
  return getActiveThemes(date)[0] ?? null;
}

// ──────────────────────────────────────────────────────────────
// Combinação nicho × data ("Natal na Pizzaria")
// ──────────────────────────────────────────────────────────────

export interface Niche {
  key: string;
  label: string;
  emoji: string;
  /** Ideias de item típicas do nicho, combinadas com as do tema. */
  ideas: string[];
}

export const NICHES: Niche[] = [
  {
    key: "pizzaria",
    label: "Pizzaria",
    emoji: "🍕",
    ideas: ["Pizza especial", "Borda recheada", "Refri 2L"],
  },
  {
    key: "hamburgueria",
    label: "Hamburgueria",
    emoji: "🍔",
    ideas: ["Burger do dia", "Combo fritas", "Milkshake"],
  },
  {
    key: "japonesa",
    label: "Japonesa",
    emoji: "🍣",
    ideas: ["Combinado especial", "Temaki", "Hot roll"],
  },
  {
    key: "churrasco",
    label: "Churrasco",
    emoji: "🍖",
    ideas: ["Espeto corrido", "Porção mista", "Cerveja gelada"],
  },
  {
    key: "doceria",
    label: "Doceria",
    emoji: "🍰",
    ideas: ["Bolo do dia", "Brigadeiro gourmet", "Caixa de doces"],
  },
  {
    key: "acai",
    label: "Açaí",
    emoji: "🍨",
    ideas: ["Açaí 500ml", "Complementos", "Copo família"],
  },
  {
    key: "cafeteria",
    label: "Cafeteria",
    emoji: "☕",
    ideas: ["Café especial", "Fatia de bolo", "Combo da tarde"],
  },
  {
    key: "comida-caseira",
    label: "Comida caseira",
    emoji: "🍛",
    ideas: ["Prato do dia", "Marmita", "Combo almoço"],
  },
];

export interface SeasonalOffer {
  niche: Niche;
  theme: SeasonalTheme;
  /** Ex.: "Natal na Pizzaria". */
  title: string;
  /** Ex.: "Pizza de forno a lenha + clima de Natal". */
  tagline: string;
  emoji: string;
  primary: string;
  secondary: string;
  /** Ideias de item do tema + do nicho, sem repetição. */
  menuIdeas: string[];
  cta: string;
}

/** Monta a personalização "nicho + data" (o mestre): título, cor e ideias. */
export function buildSeasonalOffer(niche: Niche, theme: SeasonalTheme): SeasonalOffer {
  const menuIdeas = [...theme.menuIdeas, ...niche.ideas].filter(
    (idea, i, all) => all.indexOf(idea) === i,
  );
  return {
    niche,
    theme,
    title: `${theme.name} na ${niche.label}`,
    tagline: `${niche.ideas[0]} + clima de ${theme.name}`,
    emoji: `${niche.emoji}${theme.emoji}`,
    primary: theme.primary,
    secondary: theme.secondary,
    menuIdeas,
    cta: `Crie seu cardápio nesse ${theme.name}`,
  };
}

/**
 * Ofertas que o Pracinha sugere para o dono: o tema que está valendo agora
 * (se houver) e os próximos do calendário, todos combinados com o nicho.
 * Sem tema ativo, cai no próximo do ano — nunca devolve lista vazia.
 */
export function suggestOffers(nicheKey: string, date: Date = new Date()): SeasonalOffer[] {
  const niche = NICHES.find((n) => n.key === nicheKey) ?? NICHES[0];
  const active = getActiveThemes(date);
  const upcoming = SEASONAL_THEMES.filter((t) => !active.includes(t)).sort(
    (a, b) => b.priority - a.priority,
  );
  return [...active, ...upcoming].slice(0, 4).map((t) => buildSeasonalOffer(niche, t));
}

/** Busca um tema pela chave (para reidratar uma escolha salva). */
export function themeByKey(key: string): SeasonalTheme | null {
  return SEASONAL_THEMES.find((t) => t.key === key) ?? null;
}

/** Busca um nicho pela chave. */
export function nicheByKey(key: string): Niche | null {
  return NICHES.find((n) => n.key === key) ?? null;
}

/** Palavras que denunciam o nicho no nome/descrição da loja. */
const NICHE_HINTS: Record<string, string[]> = {
  pizzaria: ["pizza", "pizzaria", "esfiha", "calabresa"],
  hamburgueria: ["burg", "hamburg", "burger", "lanche", "hot dog", "cachorro"],
  japonesa: ["sushi", "japon", "temaki", "yakisoba", "oriental"],
  churrasco: ["churrasc", "espeto", "barbecue", "grelhado", "costela"],
  doceria: ["doce", "bolo", "confeitaria", "brigadeir", "cupcake", "sobremesa"],
  acai: ["açaí", "acai", "sorvete", "milkshake", "gelato"],
  cafeteria: ["café", "cafe", "cafeteria", "coffee", "padaria"],
  "comida-caseira": ["caseir", "marmita", "marmitex", "almoço", "comida", "restaurante"],
};

/**
 * Adivinha o nicho pelo texto (nome + descrição). Sem pista, cai em comida
 * caseira — é o nicho mais genérico e nunca engana o dono.
 */
export function inferNiche(text: string): Niche {
  const haystack = text.toLowerCase();
  for (const niche of NICHES) {
    const hints = NICHE_HINTS[niche.key] ?? [];
    if (hints.some((h) => haystack.includes(h))) return niche;
  }
  return nicheByKey("comida-caseira")!;
}
