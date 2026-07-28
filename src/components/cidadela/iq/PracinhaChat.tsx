import { useState } from "react";

type Message = {
  id: number;
  role: "user" | "pracinha";
  text: string;
  timestamp: Date;
};

export function PracinhaChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "pracinha",
      text: "E aí, soldado! Tô aqui pra te ajudar com o que precisar. Pode perguntar!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");

  function handleSend() {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      text: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simular resposta do Pracinha
    setTimeout(() => {
      const pracinhaResponses = [
        "Boa pergunta! Vou pensar nisso...",
        "Interessante! Deixa eu ver o que eu sei sobre isso.",
        "Hmm, isso me lembra algo da trincheira...",
        "Bora lá! Tô aqui pra ajudar.",
        "Fica tranquilo, a gente resolve isso junto.",
      ];
      const randomResponse =
        pracinhaResponses[Math.floor(Math.random() * pracinhaResponses.length)];

      const pracinhaMessage: Message = {
        id: Date.now() + 1,
        role: "pracinha",
        text: randomResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, pracinhaMessage]);
    }, 1000);
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-secondary">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-stencil text-sm">Chat com Pracinha</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-[color:var(--brass)] text-[color:var(--matte)]"
                  : "bg-background text-foreground"
              }`}
            >
              <p>{msg.text}</p>
              <p className="mt-1 text-[10px] opacity-70">
                {msg.timestamp.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Pergunte ao Pracinha..."
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            className="rounded-lg bg-[color:var(--brass)] px-4 py-2 text-sm text-[color:var(--matte)] disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
