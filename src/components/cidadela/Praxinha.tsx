import { Send } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { CobraFumando } from "@/components/CobraFumando";
import { useStore } from "@/modules/cidadela-core/store";
import { MEMORY_WINDOW, askPraxinha } from "@/modules/pracinha-ai/gemini";
import type { RobotConfig } from "@/lib/types";

export function PracinhaIA() {
  const { state, update } = useStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRobot, setSelectedRobot] = useState<RobotConfig | null>(null);
  const [showRobotSelector, setShowRobotSelector] = useState(false);
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
    
    const systemPrompt = selectedRobot
      ? `Você é ${selectedRobot.name}, um robô com ideologia ${selectedRobot.ideology}, personalidade ${selectedRobot.personality}, estratégia ${selectedRobot.strategy}. Agressividade: ${selectedRobot.aggressiveness}%, Eloquência: ${selectedRobot.eloquence}%, Lógica: ${selectedRobot.logic}%. Responda de acordo com sua personalidade e ideologia.`
      : "Você é o Pracinha IA, assistente da Cantina do Pracinha.";

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
      systemPrompt,
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
            <p className="text-stencil text-sm">PRACINHA IA</p>
            <p className="text-tech text-[9px] text-muted-foreground">
              {selectedRobot ? selectedRobot.name : "Gemini 2.5 Flash"} · memória de {MEMORY_WINDOW} mensagens
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRobotSelector(!showRobotSelector)}
            className="text-tech text-[9px] text-muted-foreground hover:text-foreground"
          >
            {selectedRobot ? "Trocar Robô" : "Usar Robô"}
          </button>
          <button
            type="button"
            onClick={() => update((prev) => ({ ...prev, conversation: [] }))}
            className="text-tech text-[9px] text-muted-foreground hover:text-foreground"
          >
            Limpar
          </button>
        </div>
      </div>

      {showRobotSelector && (
        <div className="border-b border-border bg-secondary px-4 py-2">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => { setSelectedRobot(null); setShowRobotSelector(false); }}
              className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
            >
              Pracinha IA (padrão)
            </button>
            {state.cidadela.robots.map((robot, index) => (
              <button
                key={index}
                type="button"
                onClick={() => { setSelectedRobot(robot); setShowRobotSelector(false); }}
                className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
              >
                {robot.name} ({robot.ideology})
              </button>
            ))}
            {state.cidadela.robots.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum robô criado. Vá ao Laboratório de Robô.
              </p>
            )}
          </div>
        </div>
      )}

      {selectedRobot && (
        <div className="border-b border-border bg-secondary px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="text-xs">
              <span className="font-medium">{selectedRobot.name}</span>
              <span className="ml-2 text-muted-foreground">{selectedRobot.ideology}</span>
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span>Agr: {selectedRobot.aggressiveness}%</span>
              <span>Elo: {selectedRobot.eloquence}%</span>
              <span>Lóg: {selectedRobot.logic}%</span>
            </div>
          </div>
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {state.conversation.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedRobot 
              ? `Converse com ${selectedRobot.name}. Ele responde de acordo com sua personalidade e ideologia.`
              : "Crie um robô no Laboratório e converse com ele aqui, ou use o Pracinha IA padrão para perguntas sobre o cardápio."}
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
        {loading && <p className="text-tech text-[10px] text-muted-foreground">{selectedRobot?.name || "Pracinha"} digitando…</p>}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={selectedRobot ? `Fale com ${selectedRobot.name}…` : "Fale com o Pracinha IA…"}
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
