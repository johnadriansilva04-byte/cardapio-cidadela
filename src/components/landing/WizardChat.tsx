import { useEffect, useRef, useState } from "react";
import { Camera, Check, MessageCircle, RotateCcw, Sparkles, Store, User } from "lucide-react";
import { brl, cn } from "@/lib/utils";
import { WIZARD_MENU, WIZARD_SCRIPT } from "@/components/landing/landing-data";

interface Bubble {
  id: number;
  role: "bot" | "user";
  text: string;
}

/**
 * "Montei seu cardápio" — a criação por conversa, ao vivo.
 *
 * Espelha o `RestaurantChatWizard` de verdade: uma pergunta por vez, o dono
 * responde e o cardápio se monta sozinho no fim. Aqui é animação de vitrine
 * (sem IA, sem backend), em loop, para o visitante ver o fluxo sem clicar.
 */
export function WizardChat() {
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [typing, setTyping] = useState(false);
  const [done, setDone] = useState(false);
  const [cycle, setCycle] = useState(0);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) =>
      timers.push(setTimeout(() => !cancelled && fn(), ms));

    let t = 300;
    WIZARD_SCRIPT.forEach((step) => {
      at(t, () => {
        setTyping(true);
        setMessages((prev) => [...prev, { id: ++idRef.current, role: "bot", text: step.q }]);
      });
      t += 1200;
      at(t, () => {
        setTyping(false);
        setMessages((prev) => [...prev, { id: ++idRef.current, role: "user", text: step.a }]);
      });
      t += 900;
    });
    at(t + 400, () => {
      setTyping(false);
      setDone(true);
    });
    at(t + 6000, () => setCycle((c) => c + 1));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [cycle]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing, done]);

  function restart() {
    setMessages([]);
    setDone(false);
    idRef.current = 0;
    setCycle((c) => c + 1);
  }

  return (
    <div className="relative mx-auto w-full max-w-[400px]">
      <div
        aria-hidden
        className="animate-aurora absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-tr from-violet-500/25 via-cyan-500/10 to-blue-500/20 blur-3xl"
      />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#14141d] to-[#0a0a10] p-2.5 shadow-[0_40px_90px_-25px_rgba(139,92,246,0.45)]">
        <div className="overflow-hidden rounded-[1.6rem] border border-white/[0.06] bg-[#0b0b12]">
          <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 text-black">
              <Store className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white">Monte seu cardápio</p>
              <p className="flex items-center gap-1 text-[10px] text-violet-300/80">
                <Sparkles className="size-2.5" /> A Pracinha pergunta, você responde
              </p>
            </div>
            <button
              type="button"
              onClick={restart}
              className="hit-area grid size-7 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Refazer"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="h-[212px] space-y-2.5 overflow-y-auto px-3 py-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "animate-slide-up flex items-start gap-2",
                  m.role === "user" && "flex-row-reverse",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                    m.role === "bot"
                      ? "bg-violet-500/20 text-violet-300"
                      : "bg-white/10 text-gray-300",
                  )}
                >
                  {m.role === "bot" ? (
                    <MessageCircle className="size-3" />
                  ) : (
                    <User className="size-3" />
                  )}
                </span>
                <p
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed",
                    m.role === "bot"
                      ? "rounded-tl-sm border border-white/[0.07] bg-white/[0.04] text-gray-200"
                      : "rounded-tr-sm bg-violet-500 text-black",
                  )}
                >
                  {m.text}
                </p>
              </div>
            ))}
            {typing && (
              <div className="flex items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet-500/20 text-violet-300">
                  <MessageCircle className="size-3" />
                </span>
                <span className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-white/[0.07] bg-white/[0.04] px-3 py-2.5">
                  <Dot d={0} />
                  <Dot d={150} />
                  <Dot d={300} />
                </span>
              </div>
            )}
          </div>

          {done && (
            <div className="animate-pop-in border-t border-white/[0.07] px-3 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-emerald-300">
                <Check className="size-3.5" /> Cardápio pronto! É isto que seu cliente vê:
              </p>
              <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {WIZARD_MENU.map((p) => (
                  <div
                    key={p.name}
                    className="w-24 shrink-0 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03]"
                  >
                    <div className="grid h-14 place-items-center bg-gradient-to-b from-violet-500/15 to-transparent text-2xl">
                      {p.emoji}
                    </div>
                    <div className="border-t border-white/[0.06] px-2 py-1.5">
                      <p className="truncate text-[10px] font-bold text-white">{p.name}</p>
                      <p className="text-[10px] font-black text-cyan-300">{brl(p.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-500">
                <Camera className="size-3" /> Ou tire uma foto do cardápio antigo e a gente monta
                sozinho.
              </p>
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-500">
        <Sparkles className="size-3" /> Sem formulário de 20 campos. Uma conversa e pronto.
      </p>
    </div>
  );
}

function Dot({ d }: { d: number }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-gray-400"
      style={{ animationDelay: `${d}ms`, animationDuration: "900ms" }}
    />
  );
}
