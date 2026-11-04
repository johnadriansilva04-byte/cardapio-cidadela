import { extractJson } from "@/api/lib/ai";
import type { ChatMessage } from "@/api/lib/ai";

/**
 * Mapeia o pedido escrito em texto livre ("2 x-burger sem cebola e um guaraná")
 * para itens do cardápio do restaurante.
 *
 * REGRA DE OURO: a IA NUNCA define preço. Ela só devolve `product_id`,
 * `quantity`, `addon_ids` e `notes` — exatamente o que o cliente mandaria
 * tocando no cardápio. O preço continua sendo recalculado no servidor pela RPC
 * `create_order_atomic`, então uma alucinação da IA não muda o que o cliente
 * paga. Se a IA inventar um produto/aditivo, ele é descartado aqui (só passa o
 * que existe no catálogo).
 *
 * O parser determinístico roda SEMPRE e casa por nome; a IA só entra quando
 * disponível, para entender sinônimos e frases ("aquele lanche com bacon").
 * Sem token, o caminho por palavra-chave ainda monta o pedido.
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
  const hay = ` ${norm(segment)} `;
  const found: string[] = [];
  for (const a of addons) {
    const n = norm(a.name);
    if (n.length < 3) continue;
    if (hay.includes(` ${n} `) || hay.includes(` ${n}`)) found.push(a.id);
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
 * com um produto. É o que garante que o recurso funciona sem IA.
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

export function buildOrderPrompt(products: MenuProduct[], addons: MenuAddon[]): ChatMessage {
  const catalog = products.map((p) => `- ${p.id} = ${p.name}`).join("\n");
  const addonList = addons.map((a) => `- ${a.id} = ${a.name}`).join("\n");
  return {
    role: "system",
    content: `Você monta o carrinho de um cardápio a partir do que o cliente escreveu.
Responda SÓ com JSON, no formato {"lines":[{"product_id":"...","quantity":1,"addon_ids":[],"notes":""}]}.

PRODUTOS (use EXATAMENTE este id):
${catalog}

ADICIONAIS (use EXATAMENTE este id; só os que existem):
${addonList || "(nenhum)"}

REGRAS
- Use apenas ids das listas acima. Nunca invente id, produto ou preço.
- "quantity" é um número inteiro de 1 a 50.
- "addon_ids" só para adicionais citados que existam na lista.
- "notes" para pedidos como "sem cebola", "bem passado" (máx. 100 caracteres).
- Se não reconhecer algo, ignore. Não invente.`,
  };
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

/** Extrai `{lines:[...]}` de uma resposta de IA. */
export function parseAiOrder(text: string): OrderDraftLine[] {
  const parsed = extractJson<{ lines?: unknown }>(text);
  if (!parsed || !Array.isArray(parsed.lines)) return [];
  return parsed.lines
    .filter((l): l is Record<string, unknown> => Boolean(l) && typeof l === "object")
    .map((l) => ({
      product_id: String(l.product_id ?? ""),
      quantity: Number(l.quantity ?? 1),
      addon_ids: Array.isArray(l.addon_ids) ? l.addon_ids.map(String) : [],
      notes: typeof l.notes === "string" ? l.notes : "",
    }))
    .filter((l) => l.product_id);
}
