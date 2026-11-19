// Fluxo de criação de restaurante em modo conversa.
//
// O formulário completo (8 seções, ~20 campos) assusta quem só quer o cardápio
// no ar. Aqui a mesma coleta acontece uma pergunta por vez, sem IA: cada passo
// tem validação determinística e preenche o mesmo `RestaurantFormValues` por
// trás. É o caminho padrão na criação; o formulário continua disponível para
// quem prefere revisar tudo de uma vez.

import { DEFAULT_OPERATING_HOURS, type OperatingHours } from "@/lib/operatingHours";
import { UF_NAMES } from "@/lib/brazilStates";

/** Campo do formulário que um passo alimenta. `null` = passo de revisão. */
export type ChatField =
  | "name"
  | "description"
  | "whatsapp"
  | "phone"
  | "address"
  | "delivery_fee"
  | "neighborhoods"
  | "pix_key"
  | "operating_hours"
  | "primary_color";

export interface ChatChoice {
  label: string;
  /** Chave do preset (`HOURS_PRESETS` / `COLOR_PRESETS`) ou valor literal. */
  value: string;
  hint?: string;
}

export interface ChatStep {
  id: string;
  field: ChatField | null;
  question: string;
  hint?: string;
  placeholder?: string;
  /**
   * `number` só muda o teclado; `neighborhoods` busca os bairros da cidade e
   * deixa o dono marcar quais atende (com a taxa de cada um).
   */
  kind: "text" | "number" | "choice" | "neighborhoods";
  optional?: boolean;
  choices?: ChatChoice[];
}

export const CHAT_STEPS: ChatStep[] = [
  {
    id: "name",
    field: "name",
    question: "Vamos colocar seu cardápio no ar! Qual é o nome do seu restaurante?",
    placeholder: "Ex: Cantina da Pracinha",
    kind: "text",
  },
  {
    id: "description",
    field: "description",
    question: "Quer um slogan ou uma descrição curta? Aparece embaixo do nome.",
    hint: "Opcional — pode pular.",
    placeholder: "Ex: Massas artesanais desde 2018",
    kind: "text",
    optional: true,
  },
  {
    id: "whatsapp",
    field: "whatsapp",
    question: "Qual WhatsApp vai receber os pedidos?",
    hint: "Com DDD. É por aqui que os pedidos chegam — o botão de enviar o pedido abre a conversa com este número.",
    placeholder: "(48) 99999-9999",
    kind: "text",
  },
  {
    id: "phone",
    field: "phone",
    question: "Quer deixar um telefone fixo de contato?",
    hint: "Opcional — só para o cliente tirar dúvidas. Os pedidos vão para o WhatsApp acima.",
    placeholder: "(48) 3333-4444",
    kind: "text",
    optional: true,
  },
  {
    id: "address",
    field: "address",
    question: "Onde você fica? Rua, número e bairro.",
    hint: "Opcional — só se você entrega ou quer mostrar no cardápio.",
    placeholder: "Rua das Flores, 123, Centro",
    kind: "text",
    optional: true,
  },
  {
    id: "neighborhoods",
    field: "neighborhoods",
    question: "De quais bairros você entrega?",
    hint: "Digite a cidade e eu busco os bairros. Você marca os que atende e define a taxa de cada um.",
    placeholder: "Ex: Florianópolis",
    kind: "neighborhoods",
    optional: true,
  },
  {
    id: "pix_key",
    field: "pix_key",
    question: "Qual sua chave PIX? Ela vira o QR Code na hora do pagamento.",
    hint: "Opcional — CPF, telefone, e-mail ou chave aleatória.",
    placeholder: "Ex: cantina@email.com",
    kind: "text",
    optional: true,
  },
  {
    id: "operating_hours",
    field: "operating_hours",
    question: "Quando você atende? Escolha uma opção ou ajuste depois.",
    kind: "choice",
    optional: true,
    choices: [
      { label: "Todos os dias, 17h–00h", value: "noite", hint: "Padrão para quem vende à noite" },
      { label: "Todos os dias, 11h–15h", value: "almoco", hint: "Almoço" },
      { label: "Seg a sáb, 18h–23h", value: "noite-sem-dom", hint: "Domingo fechado" },
      { label: "Configurar depois", value: "skip" },
    ],
  },
  {
    id: "primary_color",
    field: "primary_color",
    question: "Por último: qual a cara do seu cardápio? Escolha um tema.",
    hint: "Dá para trocar depois. O tema pinta botões, preços e detalhes.",
    kind: "choice",
    optional: true,
    choices: [
      { label: "Ciano e violeta", value: "ciano", hint: "Padrão" },
      { label: "Laranja e vermelho", value: "laranja" },
      { label: "Verde e esmeralda", value: "verde" },
      { label: "Rosa e roxo", value: "rosa" },
      { label: "Azul e ciano", value: "azul" },
    ],
  },
];

/** Bairro coletado no passo `list`. A gravação acontece depois do insert. */
export interface DraftNeighborhood {
  name: string;
  fee: string;
}

/**
 * Interpreta uma linha do passo de bairros: "Centro 5", "Trindade - 8,00",
 * "Centro" (taxa vazia = usa a taxa padrão). `null` se não houver nome.
 */
export function parseNeighborhoodLine(raw: string): DraftNeighborhood | null {
  const line = raw.trim();
  if (!line) return null;
  // O valor é o último número da linha; o resto é o nome.
  const match = line.match(/^(.*?)[\s\-–—:]*([\d]+(?:[.,]\d{1,2})?)\s*$/);
  if (match && match[1].trim()) {
    const fee = normalizeDeliveryFee(match[2]);
    if (fee !== null) return { name: match[1].trim().slice(0, 60), fee };
  }
  return { name: line.slice(0, 60), fee: "" };
}

/** Passo final (revisão) — não coleta nada, só confirma. */
export const REVIEW_STEP_ID = "review";

/** `true` quando o passo é o de revisão (sem campo e sem choices). */
export function isReviewStep(index: number): boolean {
  return index >= CHAT_STEPS.length;
}

/**
 * Índice do primeiro passo ainda sem resposta.
 *
 * Na criação o formulário está vazio, então começa do zero. Na edição pula
 * direto para o que falta (o dono pode voltar para revisar o resto) — assim
 * "repassar pelo chat" não obriga a redigitar tudo.
 */
export function firstIncompleteStep(values: Record<string, unknown>): number {
  for (let i = 0; i < CHAT_STEPS.length; i++) {
    const field = CHAT_STEPS[i].field;
    if (!field || (CHAT_STEPS[i].kind !== "text" && CHAT_STEPS[i].kind !== "number")) continue;
    const v = values[field];
    if (v === undefined || v === null || String(v).trim() === "") return i;
  }
  return CHAT_STEPS.length;
}

/**
 * Separa a cidade da UF no que o dono digita: "Florianópolis SC",
 * "Florianópolis - SC", "florianopolis/sc". A UF é opcional — o geocoder
 * devolve o estado de qualquer forma. Só é tratada como UF quando há um
 * separador e as duas letras são uma UF real: sem isso, "Florianópolis"
 * terminaria com "is" e a cidade viraria "Florianópol".
 */
export function parseCityInput(raw: string): { city: string; uf: string } | null {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return null;
  const match = /^(.*?)[\s,/-]+([A-Za-z]{2})$/.exec(value);
  if (match && match[1].trim().length >= 2) {
    const uf = match[2].toUpperCase();
    if (UF_NAMES[uf]) return { city: match[1].trim(), uf };
  }
  return { city: value, uf: "" };
}

export const HOURS_PRESETS: Record<string, OperatingHours> = {
  noite: { ...DEFAULT_OPERATING_HOURS },
  almoco: Object.fromEntries(
    Object.keys(DEFAULT_OPERATING_HOURS).map((k) => [
      k,
      { closed: false, open: "11:00", close: "15:00" },
    ]),
  ) as OperatingHours,
  "noite-sem-dom": {
    ...DEFAULT_OPERATING_HOURS,
    dom: { closed: true, open: "18:00", close: "23:00" },
    seg: { closed: false, open: "18:00", close: "23:00" },
    ter: { closed: false, open: "18:00", close: "23:00" },
    qua: { closed: false, open: "18:00", close: "23:00" },
    qui: { closed: false, open: "18:00", close: "23:00" },
    sex: { closed: false, open: "18:00", close: "23:00" },
    sab: { closed: false, open: "18:00", close: "23:00" },
  },
};

export interface ColorPreset {
  label: string;
  primary: string;
  secondary: string;
}

export const COLOR_PRESETS: Record<string, ColorPreset> = {
  ciano: { label: "Ciano e violeta", primary: "#06b6d4", secondary: "#8b5cf6" },
  laranja: { label: "Laranja e vermelho", primary: "#f97316", secondary: "#ef4444" },
  verde: { label: "Verde e esmeralda", primary: "#22c55e", secondary: "#10b981" },
  rosa: { label: "Rosa e roxo", primary: "#ec4899", secondary: "#8b5cf6" },
  azul: { label: "Azul e ciano", primary: "#3b82f6", secondary: "#06b6d4" },
};

/** Só dígitos, com DDI 55 quando o número parece brasileiro e não tem DDI. */
export function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

/** Aceita "5", "5,00", "R$ 5.00" → "5.00". `null` se não for valor plausível. */
export function normalizeDeliveryFee(raw: string): string | null {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0 || n > 999) return null;
  return n.toFixed(2);
}

/** Respostas que significam "não tenho / pula" num passo opcional. */
const SKIP_WORDS = new Set([
  "nao",
  "não",
  "n",
  "pular",
  "pula",
  "pode pular",
  "nenhum",
  "nenhuma",
  "nada",
  "sem",
  "nao tenho",
  "não tenho",
  "nao tenho nenhum",
  "-",
  "—",
]);

/** `true` quando a resposta é uma negativa/recusa num passo opcional. */
export function isSkipAnswer(raw: string): boolean {
  const value = raw
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ");
  if (SKIP_WORDS.has(value)) return true;
  // "não tenho", "não, obrigado", "não tem"… Sem dígito não há dado a salvar,
  // então a negativa é sempre um pulo — antes ela caía na validação de número
  // e virava "Telefone inválido", como se o dono tivesse errado a digitação.
  if (/\d/.test(value)) return false;
  return /^(n[aã]o|nunca|nem)\b/.test(value);
}

export interface AnswerResult {
  ok: boolean;
  /** Mensagem de erro para mostrar no chat quando `ok` é `false`. */
  error?: string;
  /** Valor normalizado (para `whatsapp`/`delivery_fee`) ou o texto cru. */
  value?: string;
  /** `true` quando o dono respondeu "não" e o passo foi pulado. */
  skipped?: boolean;
}

/**
 * Valida e normaliza a resposta de um passo de texto.
 *
 * Devolve `error` em vez de lançar: o chat mostra a mensagem na hora e deixa o
 * dono corrigir, sem perder o que ele digitou. Passos opcionais aceitam vazio
 * e também uma negativa ("não", "pular") — antes um "não" no telefone caía na
 * validação de número e virava "Telefone inválido", como se ele tivesse errado.
 */
export function validateAnswer(step: ChatStep, raw: string): AnswerResult {
  const value = raw.trim();
  if (!value) {
    if (step.optional) return { ok: true, value: "", skipped: true };
    return { ok: false, error: "Preciso dessa informação para continuar." };
  }
  if (step.optional && isSkipAnswer(value)) return { ok: true, value: "", skipped: true };
  if (step.field === "whatsapp") {
    const n = normalizeWhatsapp(value);
    if (!n)
      return { ok: false, error: "Telefone inválido. Use DDD + número, ex: (48) 99999-9999." };
    return { ok: true, value: n };
  }
  if (step.field === "delivery_fee") {
    const f = normalizeDeliveryFee(value);
    if (!f) return { ok: false, error: "Valor inválido. Ex: 5 ou 5,00." };
    return { ok: true, value: f };
  }
  if (step.field === "name" && value.length < 2) {
    return { ok: false, error: "O nome precisa de pelo menos 2 letras." };
  }
  if (step.kind === "neighborhoods" && value.length < 2) {
    return { ok: false, error: "Digite o nome da cidade. Ex: Florianópolis." };
  }
  if (step.field === "phone") {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 8) {
      return {
        ok: false,
        error: "Telefone inválido. Ex: (48) 3333-4444. Se não tiver, toque em Pular.",
      };
    }
    return { ok: true, value };
  }
  return { ok: true, value };
}
