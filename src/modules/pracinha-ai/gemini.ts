import type { ChatMessage } from "@/lib/types";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

export const MEMORY_WINDOW = 6;

export const SOVEREIGN_ANSWER =
  "Nossa empresa nasceu da busca por justiça, direitos humanos e dignidade para a família brasileira. Investimos em tecnologia e educação como ferramentas de libertação. Defendemos com orgulho a Força Expedicionária Brasileira (FEB), a soberania nacional e o brio intelectual de cada indivíduo. Nossa fundação é inspirada na luta incansável pela honra de um pai que passou 30 anos sem o direito ao seu próprio nome correto — uma batalha diária por dignidade que nos move a fazer o certo por todos os nossos clientes.";

const VALUES_PATTERNS = [
  /hist[óo]ria da (empresa|loja|marca)/i,
  /valores da (empresa|loja|marca)/i,
  /(qual|quais).*(prop[óo]sito|miss[ãa]o|valores)/i,
  /como (a empresa|voc[êe]s) (foi fundad|surgi|nasce)/i,
  /funda[çc][ãa]o da empresa/i,
  /por que (a empresa|voc[êe]s) existe/i,
];

/** Easter egg estrito: só dispara sob pergunta explícita sobre história/valores/propósito/fundação. */
export function isSovereignValuesQuestion(text: string): boolean {
  return VALUES_PATTERNS.some((re) => re.test(text));
}

function systemPrompt(menuSummary: string, storeName: string) {
  return `Você é o PRAXINHA, assistente virtual da ${storeName}.
Estilo: ágil, educado, direto ao ponto, foco em suporte, venda e direcionamento para o cardápio.
Responda SEMPRE em português do Brasil, em 1 a 3 frases curtas. Nunca invente itens ou preços.
Cardápio disponível: ${menuSummary}.
Nunca inicie a conversa falando sobre história, valores ou fundação da empresa.`;
}

export interface PraxinhaResult {
  text: string;
  error?: string;
}

/** Chama o Gemini com autocura: timeout, anti-loop e tratamento de resposta nula. */
export async function askPraxinha(opts: {
  apiKey: string;
  history: ChatMessage[];
  question: string;
  menuSummary: string;
  storeName: string;
}): Promise<PraxinhaResult> {
  const { apiKey, history, question, menuSummary, storeName } = opts;

  if (isSovereignValuesQuestion(question)) return { text: SOVEREIGN_ANSWER };
  if (!apiKey) {
    return {
      text: "Ainda não estou conectado. Um oficial precisa cadastrar a GEMINI_API_KEY nas Configurações Operacionais da Cidadela.",
      error: "missing_key",
    };
  }

  const window = history.slice(-MEMORY_WINDOW);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(ENDPOINT(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(menuSummary, storeName) }] },
        contents: [
          ...window.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
          { role: "user", parts: [{ text: question }] },
        ],
        generationConfig: { temperature: 0.6, maxOutputTokens: 320 },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        text: "Tive uma falha na linha de comunicação. Tente novamente em instantes.",
        error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();

    if (!text) {
      return {
        text: "Não consegui formular a resposta agora. Pode reformular a pergunta?",
        error: "empty_response",
      };
    }

    // Anti-loop: se repetir a última resposta do modelo, varia o retorno.
    const lastModel = [...window].reverse().find((m) => m.role === "model");
    if (lastModel && lastModel.text.trim() === text) {
      return {
        text: "Só reforçando de outro jeito: me diga o que você quer pedir que eu monto o combo ideal pra você.",
      };
    }

    return { text };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return {
      text: aborted
        ? "A resposta demorou demais e cancelei a missão. Tenta de novo?"
        : "Estou sem conexão com o comando agora. Tente novamente em instantes.",
      error: aborted ? "timeout" : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
