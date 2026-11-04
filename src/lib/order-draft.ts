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
  let best: MenuProduct | null = null;
  let bestScore = 0;
  for (const p of products) {
    const nameTokens = norm(p.name).split(" ").filter(Boolean);
    const anchor = nameTokens.find((t) => t.length >= 3);
    if (!anchor) continue;
    if (!hayTokens.some((t) => tokenMatch(t, anchor))) continue;
    let score = 0;
    for (const nt of nameTokens) {
      if (nt.length < 3) continue;
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

function parseQuantity(segment: string): number {
  const m = segment.match(/(\d+)\s*(x|un|unid|unidade)?\b/);
  if (m) {
    const n = Math.floor(Number(m[1]));
    if (n >= 1 && n <= 50) return n;
  }
  const words = norm(segment).split(" ");
  for (const w of words) {
    if (WORD_QTY[w]) return WORD_QTY[w];
  }
  return 1;
}

/** Adicionais citados, restritos aos que existem no catálogo do produto. */
function parseAddons(segment: string, addons: MenuAddon[]): string[] {
  const hayTokens = norm(segment).split(" ").filter(Boolean);
  const found: string[] = [];
  for (const a of addons) {
    const n = norm(a.name);
    if (n.length < 3) continue;
    if (hayTokens.some((t) => tokenMatch(t, n))) found.push(a.id);
  }
  return found;
}

/** Observações úteis ("sem cebola", "bem passado", "sem gelo"). */
function parseNotes(segment: string): string {
  const m = segment.match(/\b(sem|bem|pouco|muito|com|extra)\b[^,.;]*/i);
  return m ? m[0].trim().slice(0, 120) : "";
}

/**
 * Parser determinístico: quebra o texto por vírgula/" e " e casa cada trecho
 * com um produto. É o que garante que o recurso funciona sem IA — e sem rede.
 */
export function parseOrderDeterministic(
  text: string,
  products: MenuProduct[],
  addons: MenuAddon[],
): OrderDraftResult {
  const segments = text
    .split(/[,;\n]|\be\b(?=\s+\d|\s+(um|uma|dois|duas|tres|três|o|a)\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const lines: OrderDraftLine[] = [];
  const unmatched: string[] = [];
  const byProduct = new Map<string, OrderDraftLine>();

  for (const seg of segments) {
    const product = matchProduct(seg, products);
    if (!product) {
      unmatched.push(seg);
      continue;
    }
    const qty = parseQuantity(seg);
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
