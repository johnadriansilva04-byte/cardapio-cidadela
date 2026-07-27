import { Send } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { CobraFumando } from "@/components/CobraFumando";
import { useStore } from "@/modules/cidadela-core/store";
import { MEMORY_WINDOW, askPraxinha } from "@/modules/pracinha-ai/gemini";

export function PraxinhaChat() {
  const { state, update } = useStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const menuSummary = useMemo(
    () =>
      state.categories
        .map((c) => `${c.name}: ${c.items.map((i) => `${i.name} (R$${i.price.toFixed(2)})`).join(", ")}`)
        .join(" | "),
    [state.categories],
  );

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const now = new Date().toISOString();
    const history = state.conversation;
    update((prev) => ({
      ...prev,
      conversation: [...prev.conversation, { role: "user" as const, text: question, at: now }].slice(-40),
    }));
    setInput("");
    setLoading(true);

    const result = await askPraxinha({
      apiKey: state.integrations.geminiApiKey,
      history,
      question,
      menuSummary,
      storeName: state.store.name,
    });

    update((prev) => ({
      ...prev,
      conversation: [
        ...prev.conversation,
        { role: "model" as const, text: result.text, at: new Date().toISOString() },
      ].slice(-40),
    }));
    setLoading(false);
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }));
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <CobraFumando className="size-6 text-[color:var(--brass)]" />
          <div>
            <p className="text-stencil text-sm">PRAXINHA</p>
            <p className="text-tech text-[9px] text-muted-foreground">
              Gemini 2.5 Flash · memória de {MEMORY_WINDOW} mensagens
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => update((prev) => ({ ...prev, conversation: [] }))}
          className="text-tech text-[9px] text-muted-foreground hover:text-foreground"
        >
          Limpar
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {state.conversation.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Pergunte sobre o cardápio, pedidos ou suporte. O Praxinha responde curto e direto.
          </p>
        )}
        {state.conversation.map((m, idx) => (
          <div
            key={`${m.at}-${idx}`}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-[color:var(--olive)] text-[color:var(--sand)]"
                : "bg-secondary"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && <p className="text-tech text-[10px] text-muted-foreground">Praxinha digitando…</p>}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Fale com o Praxinha…"
          className="flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={loading}
          aria-label="Enviar mensagem"
          className="grid size-10 place-items-center rounded-lg bg-[color:var(--brass)] text-[color:var(--matte)] disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
