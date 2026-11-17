/**
 * Parser do "garçom digital" — PURO e client-safe (sem import de servidor).
 *
 * Vive em `src/lib` de propósito: o mesmo código roda no servidor
 * (`api/lib/order-draft.ts`) e no cliente, como fallback offline. Assim o
 * "Pedir por texto" continua funcionando sem rede, com o cardápio já carregado.
 *
 * REGRA DE OURO: nada aqui devolve preço. Só `product_id`, `quantity`,
 * `addon_ids` e `notes` — o mesmo que o cliente mandaria tocando no cardápio. O
 * valor é recalculado no servidor pela RPC `create_order_atomic`.
 */

export interface MenuProduct {
  id: string;
  name: string;
  category_id?: string;
}

export interface MenuAddon {
  id: string;
  name: string;
  product_id?: string | null;
}

export interface OrderDraftLine {
  product_id: string;
  quantity: number;
  addon_ids: string[];
  notes: string;
}

export interface OrderDraftResult {
  lines: OrderDraftLine[];
  /** `true` quando a IA ajudou a montar; `false` quando foi só o parser. */
  ai: boolean;
  /** O que não foi reconhecido — a UI avisa o cliente. */
  unmatched: string[];
}

/** Normaliza para comparar nomes: minúsculo, sem acento, espaços colapsados. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Palavras que aparecem no pedido mas NUNCA são nome de item. Sem ignorá-las, o
 * match por prefixo casava "um" com qualquer nome que começasse por "um" e o
 * cliente ouvia "não achei 'um'". Aqui elas não contam como âncora nem somam
 * pontos no match.
 */
const STOPWORDS = new Set([
  "um",
  "uma",
  "uns",
  "umas",
  "o",
  "a",
  "os",
  "as",
  "do",
  "da",
  "dos",
  "das",
  "de",
  "no",
  "na",
  "nos",
  "nas",
  "em",
  "e",
  "com",
  "sem",
  "para",
  "pra",
  "por",
  "favor",
  "quero",
  "queria",
  "gostaria",
  "vou",
  "vamos",
  "tambem",
  "mais",
  "bem",
  "pouco",
  "muito",
  "extra",
  "ao",
  "ponto",
  "meio",
  "me",
  "mim",
  "dois",
  "duas",
  "tres",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "obrigado",
  "obrigada",
]);

/** Token que pode ser nome de item: 3+ letras e fora das stopwords. */
function isContentToken(t: string): boolean {
  return t.length >= 3 && !STOPWORDS.has(t);
}

/** Um token do texto casa com um token do nome? Prefixo, para "pizzas"≈"pizza". */
function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  return a.startsWith(b) || b.startsWith(a);
}

/**
 * Casa o nome do produto no texto livre. A âncora é o primeiro token com 3+
 * letras do nome (para "X-Burger" a âncora é "burger"); a partir dela, quanto
 * mais tokens do nome aparecem no texto, melhor o match — assim "x-burger
 * especial" não é confundido com "x-burger".
 */
export function matchProduct(text: string, products: MenuProduct[]): MenuProduct | null {
  const hayTokens = norm(text).split(" ").filter(Boolean);
  if (hayTokens.length === 0) return null;
  let best: MenuProduct | null = null;
  let bestScore = 0;
  for (const p of products) {
    const nameTokens = norm(p.name).split(" ").filter(Boolean);
    const anchor = nameTokens.find((t) => isContentToken(t));
    if (!anchor) continue;
    if (!hayTokens.some((t) => tokenMatch(t, anchor))) continue;
    let score = 0;
    for (const nt of nameTokens) {
      if (!isContentToken(nt)) continue;
      if (hayTokens.some((t) => tokenMatch(t, nt))) score++;
    }
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

/** Quantidade declarada antes do item ("2 x-burger", "duas pizzas"). */
const WORD_QTY: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
};

/**
 * Quantidade do trecho. Prioriza o número dito ANTES do item ("2 x-burger",
 * "duas pizzas"); se não houver, aceita um número solto depois do nome
 * ("x-burger 2"). Sem isso o número depois do nome virava 1 item.
 */
function parseQuantity(segment: string, product: MenuProduct | null): number {
  const chunks = [segment];
  if (product) {
    const firstWord = product.name.split(" ")[0];
    if (firstWord) {
      const idx = norm(segment).indexOf(norm(firstWord));
      if (idx > 0) chunks.unshift(segment.slice(0, idx));
    }
  }
  for (const chunk of chunks) {
    const m = chunk.match(/(\d+)\s*(x|un|unid|unidade)?\b/i);
    if (m) {
      const n = Math.floor(Number(m[1]));
      if (n >= 1 && n <= 50) return n;
    }
    for (const w of norm(chunk).split(" ")) {
      if (WORD_QTY[w]) return WORD_QTY[w];
    }
  }
  return 1;
}

/** Adicionais citados, restritos aos que existem no catálogo do produto. */
function parseAddons(segment: string, addons: MenuAddon[]): string[] {
  const hayTokens = norm(segment).split(" ").filter(Boolean);
  const found: string[] = [];
  for (const a of addons) {
    const nameTokens = norm(a.name).split(" ").filter(Boolean);
    const anchor = nameTokens.find((t) => isContentToken(t));
    if (!anchor) continue;
    if (hayTokens.some((t) => tokenMatch(t, anchor))) found.push(a.id);
  }
  return found;
}

/** Observações úteis ("sem cebola", "bem passado", "sem gelo"). */
function parseNotes(segment: string): string {
  const m = segment.match(/\b(sem|bem|pouco|muito|extra|ao ponto)\b[^,.;]*/i);
  return m ? m[0].trim().slice(0, 120) : "";
}

/**
 * Quebra o pedido em trechos por pontuação e pelos conectores que separam itens
 * ("e", "mais", "também"). O " e " só quebra quando o que vem depois parece um
 * item novo (número ou artigo), para não partir "pão e queijo".
 */
function splitSegments(text: string): string[] {
  return text
    .split(/[,;\n]|\be\b(?=\s+(?:\d|um|uma|dois|duas|tres|três|o|a)\b)|\b(?:mais|também|tambem)\b/i)
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
}

/**
 * Parser determinístico: quebra o texto por vírgula/conectores e casa cada
 * trecho com um produto. É o que garante que o recurso funciona sem IA — e sem
 * rede.
 */
export function parseOrderDeterministic(
  text: string,
  products: MenuProduct[],
  addons: MenuAddon[],
): OrderDraftResult {
  const segments = splitSegments(text);

  const lines: OrderDraftLine[] = [];
  const unmatched: string[] = [];
  const byProduct = new Map<string, OrderDraftLine>();

  for (const seg of segments) {
    const product = matchProduct(seg, products);
    if (!product) {
      // Só vira "não achei" se sobrar palavra de conteúdo — trecho com só
      // conectores/stopwords não vira reclamação.
      if (norm(seg).split(" ").some(isContentToken)) unmatched.push(seg);
      continue;
    }
    const qty = parseQuantity(seg, product);
    const productAddons = addons.filter((a) => !a.product_id || a.product_id === product.id);
    const addonIds = parseAddons(seg, productAddons);
    const notes = parseNotes(seg);

    const existing = byProduct.get(product.id);
    if (existing && !notes && addonIds.length === 0) {
      existing.quantity += qty;
    } else {
      const line: OrderDraftLine = {
        product_id: product.id,
        quantity: qty,
        addon_ids: addonIds,
        notes,
      };
      lines.push(line);
      byProduct.set(product.id, line);
    }
  }

  return { lines, ai: false, unmatched };
}

/**
 * Junta o resultado da IA com o determinístico. A IA ganha quando devolve
 * linhas válidas (sabe ler sinônimos); senão fica o determinístico. Em ambos os
 * casos, tudo é validado contra o catálogo real antes de sair.
 */
export function reconcileOrderDraft(
  aiLines: OrderDraftLine[],
  fallback: OrderDraftResult,
  products: MenuProduct[],
  addons: MenuAddon[],
): OrderDraftResult {
  const productIds = new Set(products.map((p) => p.id));
  const addonIds = new Set(addons.map((a) => a.id));
  const valid = aiLines
    .filter((l) => productIds.has(l.product_id))
    .map((l) => ({
      product_id: l.product_id,
      quantity: Math.max(1, Math.min(50, Math.floor(Number(l.quantity) || 1))),
      addon_ids: (l.addon_ids ?? []).filter((id) => addonIds.has(id)),
      notes: typeof l.notes === "string" ? l.notes.slice(0, 120) : "",
    }));
  if (valid.length === 0) return fallback;
  return { lines: valid, ai: true, unmatched: fallback.unmatched };
}

/** Linha pronta para exibir, com nome do produto e dos adicionais. */
export interface OrderDraftDisplayLine extends OrderDraftLine {
  name: string;
  addon_names: string[];
}

/**
 * Sugestões para quando o texto não casa com nada: os produtos cujo nome
 * compartilha algum token de conteúdo com o que o cliente escreveu. Vira os
 * "chips" que o cliente toca para adicionar — assim o chat nunca é um beco sem
 * saída ("não achei" e pronto).
 */
export function suggestProducts(text: string, products: MenuProduct[], limit = 6): MenuProduct[] {
  const hayTokens = norm(text)
    .split(" ")
    .filter((t) => isContentToken(t));
  if (hayTokens.length === 0) return products.slice(0, limit);
  const scored: { p: MenuProduct; score: number }[] = [];
  for (const p of products) {
    const nameTokens = norm(p.name).split(" ").filter(Boolean);
    let score = 0;
    for (const nt of nameTokens) {
      if (!isContentToken(nt)) continue;
      if (hayTokens.some((t) => tokenMatch(t, nt))) score++;
    }
    if (score > 0) scored.push({ p, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.p);
}

/** Frase curta do Pracinha para mostrar na conversa. */
export function buildOrderReply(lines: OrderDraftDisplayLine[], unmatched: string[]): string {
  if (lines.length === 0) {
    return "Não encontrei esses itens no cardápio. Pode escrever de outro jeito ou tocar nos itens?";
  }
  const parts = lines.map((l) => {
    const extras = [
      l.addon_names.length ? `com ${l.addon_names.join(", ")}` : "",
      l.notes ? `(${l.notes})` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `${l.quantity}× ${l.name}${extras ? ` ${extras}` : ""}`;
  });
  let reply = `Anotei: ${parts.join(", ")}.`;
  if (unmatched.length > 0) {
    reply += ` Não achei "${unmatched.join(", ")}" no cardápio — quer escolher na mão?`;
  }
  return reply;
}
