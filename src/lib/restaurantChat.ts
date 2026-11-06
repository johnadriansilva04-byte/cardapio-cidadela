// Fluxo de criação de restaurante em modo conversa.
//
// O formulário completo (8 seções, ~20 campos) assusta quem só quer o cardápio
// no ar. Aqui a mesma coleta acontece uma pergunta por vez, sem IA: cada passo
// tem validação determinística e preenche o mesmo `RestaurantFormValues` por
// trás. É o caminho padrão na criação; o formulário continua disponível para
// quem prefere revisar tudo de uma vez.

import { DEFAULT_OPERATING_HOURS, type OperatingHours } from "@/lib/operatingHours";

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
   * `number` só muda o teclado; `list` é um passo repetível (bairros) que
   * aceita várias linhas até o dono dizer "pronto".
   */
  kind: "text" | "number" | "choice" | "list";
  optional?: boolean;
  choices?: ChatChoice[];
  /** Rótulo do botão que encerra um passo `list`. */
  doneLabel?: string;
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
    hint: "Com DDD. É o número que o cliente usa para falar com você.",
    placeholder: "(48) 99999-9999",
    kind: "text",
  },
  {
    id: "phone",
    field: "phone",
    question: "Tem um telefone fixo ou outro contato?",
    hint: "Opcional — pode pular se só usa o WhatsApp.",
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
    id: "delivery_fee",
    field: "delivery_fee",
    question: "Quanto você cobra de entrega?",
    hint: "Opcional. Pode ajustar por bairro no próximo passo.",
    placeholder: "Ex: 5",
    kind: "number",
    optional: true,
  },
  {
    id: "neighborhoods",
    field: "neighborhoods",
    question: "Quer cobrar diferente por bairro? Digite o bairro e o valor, um por vez.",
    hint: "Ex: “Centro 5”. Quando terminar, toque em Pronto. Opcional.",
    placeholder: "Ex: Centro 5",
    kind: "list",
    optional: true,
    doneLabel: "Pronto, é isso",
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
    if (!field || CHAT_STEPS[i].kind === "choice" || CHAT_STEPS[i].kind === "list") continue;
    const v = values[field];
    if (v === undefined || v === null || String(v).trim() === "") return i;
  }
  return CHAT_STEPS.length;
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

export interface AnswerResult {
  ok: boolean;
  /** Mensagem de erro para mostrar no chat quando `ok` é `false`. */
  error?: string;
  /** Valor normalizado (para `whatsapp`/`delivery_fee`) ou o texto cru. */
  value?: string;
}

/**
 * Valida e normaliza a resposta de um passo de texto.
 *
 * Devolve `error` em vez de lançar: o chat mostra a mensagem na hora e deixa o
 * dono corrigir, sem perder o que ele digitou. Passos opcionais aceitam vazio.
 */
export function validateAnswer(step: ChatStep, raw: string): AnswerResult {
  const value = raw.trim();
  if (!value) {
    if (step.optional) return { ok: true, value: "" };
    return { ok: false, error: "Preciso dessa informação para continuar." };
  }
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
  if (step.field === "phone") {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 8) return { ok: false, error: "Telefone inválido. Ex: (48) 3333-4444." };
    return { ok: true, value };
  }
  return { ok: true, value };
}
