import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, Sparkles, User, X } from "lucide-react";
import { draftOrder, type DraftLine } from "@/modules/supabase/order-draft";
import type { MenuAddon, MenuProduct } from "@/lib/order-draft";
import { hexToRgba } from "@/lib/utils";

/**
 * Pracinha Pedidos — o cliente escreve o que quer ("2 x-burger sem cebola e um
 * guaraná") e o Pracinha monta o carrinho.
 *
 * O componente NÃO adiciona nada sozinho: ele devolve as linhas via `onAdd`,
 * que o cardápio aplica no carrinho de sempre (mesmo `addToCart`). Assim o
 * preço, os adicionais e o checkout continuam exatamente no caminho validado
 * pelo servidor — o chat é só uma forma mais fácil de escolher.
 */

const EXAMPLES = [
  "2 x-burger sem cebola e um guaraná",
  "uma pizza calabresa e uma coca",
  "3 pastéis e um suco",
];

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export default function PracinhaOrderChat({
  restaurantId,
  menu,
  accent = "#06b6d4",
  onAdd,
  onClose,
  onOpenCart,
}: {
  restaurantId: string;
  /** Catálogo em memória — vira o fallback offline se a rota não responder. */
  menu: { products: MenuProduct[]; addons: MenuAddon[] };
  accent?: string;
  onAdd: (lines: DraftLine[]) => void;
  onClose: () => void;
  onOpenCart: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [added, setAdded] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending]);

  async function submit(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    setTurns((t) => [...t, { role: "user", content }]);
    setInput("");
    setSending(true);
    const draft = await draftOrder(restaurantId, content, menu);
    setSending(false);
    if (!draft) {
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: "Não consegui falar com o cardápio agora. Toca nos itens ou tente de novo.",
        },
      ]);
      return;
    }
    setTurns((t) => [...t, { role: "assistant", content: draft.reply }]);
    if (draft.lines.length > 0) {
      onAdd(draft.lines);
      setAdded((n) => n + draft.lines.length);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[#0b0b12] shadow-2xl sm:rounded-[24px]">
        <header className="relative flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-5 py-4">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-xl text-white"
            style={{ backgroundColor: accent }}
          >
            <MessageCircle className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white">
              Pracinha <span className="font-normal text-gray-500">· pedir por texto</span>
            </p>
            <p className="text-[11px] text-gray-500">Escreve que eu monto seu pedido</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {turns.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Oi! Escreve o que você quer do jeito que falaria no balcão. Eu anoto e monto o
                carrinho pra você conferir.
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-gray-300 transition-colors hover:text-white"
                    style={{ borderColor: hexToRgba(accent, 0.25) }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) => (
            <div
              key={i}
              className={
                "flex items-start gap-2 " + (t.role === "user" ? "flex-row-reverse" : "flex-row")
              }
            >
              <span
                className={
                  "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full " +
                  (t.role === "user" ? "bg-white/10 text-gray-300" : "text-white")
                }
                style={
                  t.role === "assistant" ? { backgroundColor: hexToRgba(accent, 0.25) } : undefined
                }
              >
                {t.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
              </span>
              <p
                className={
                  "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed " +
                  (t.role === "user"
                    ? "rounded-tr-sm text-black"
                    : "rounded-tl-sm border border-white/[0.07] bg-white/[0.04] text-gray-200")
                }
                style={t.role === "user" ? { backgroundColor: accent } : undefined}
              >
                {t.content}
              </p>
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="size-3.5 animate-spin" /> Montando…
            </div>
          )}
        </div>

        {added > 0 && (
          <button
            type="button"
            onClick={onOpenCart}
            className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-black text-black"
            style={{ backgroundColor: accent }}
          >
            <Sparkles className="size-4" /> Ver meu pedido ({added})
          </button>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex shrink-0 items-center gap-2 border-t border-white/[0.07] px-4 py-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex.: 2 x-burger sem cebola e um guaraná"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/25"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Enviar"
            className="grid size-10 shrink-0 place-items-center rounded-full text-black disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
