import { useState, useRef, useEffect } from "react";
import { usePracinhaChat } from "@/modules/supabase/chat";

type Message = {
  id: number;
  role: "user" | "pracinha";
  text: string;
  timestamp: Date;
};

export function PracinhaChat() {
  const { messages: supabaseMessages, sendMessage, isLoading } = usePracinhaChat("iq_test");
  const [localMessages, setLocalMessages] = useState<Message[]>([
    {
      id: 1,
      role: "pracinha",
      text: "E aí, soldado! Tô aqui pra te ajudar com o que precisar. Pode perguntar!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Usar mensagens do Supabase se disponíveis, senão usar local
  const messages =
    supabaseMessages.length > 0
      ? supabaseMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          text: msg.text,
          timestamp: new Date(msg.timestamp),
        }))
      : localMessages;

  // Scroll automático para o final quando novas mensagens são adicionadas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      text: input.trim(),
      timestamp: new Date(),
    };

    // Tentar salvar no Supabase
    const saved = await sendMessage(input.trim(), "user");
    if (saved) {
      // Mensagem salva no Supabase, o hook vai atualizar automaticamente
    } else {
      // Fallback para local
      setLocalMessages((prev) => [...prev, userMessage]);
    }
    setInput("");

    // Simular resposta do Pracinha
    setTimeout(async () => {
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

      // Tentar salvar no Supabase
      const saved = await sendMessage(randomResponse, "pracinha");
      if (!saved) {
        // Fallback para local
        setLocalMessages((prev) => [...prev, pracinhaMessage]);
      }
    }, 1000);
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
      <div className="border-b border-slate-700 px-4 py-3">
        <h3 className="text-stencil text-sm text-slate-200">Chat com Pracinha</h3>
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
                  ? "bg-slate-700 text-slate-200"
                  : "bg-slate-900/50 text-slate-300"
              }`}
            >
              <p>{msg.text}</p>
              <p className="mt-1 text-[10px] opacity-70 text-slate-400">
                {msg.timestamp.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-slate-700 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Pergunte ao Pracinha..."
            className="flex-1 rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-slate-500 placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-50 hover:bg-slate-600 transition-colors"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
