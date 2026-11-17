import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Plus, Send, Sparkles, User, X } from "lucide-react";
import { draftOrder, type DraftLine } from "@/modules/supabase/order-draft";
import { suggestProducts, type MenuAddon, type MenuProduct } from "@/lib/order-draft";
import { hexToRgba } from "@/lib/utils";

/**
 * Pracinha Pedidos — o cliente escreve o que quer ("2 x-burger sem cebola e um
 * guaraná") e o Pracinha monta o carrinho.
 *
 * O componente NÃO adiciona nada sozinho: ele devolve as linhas via `onAdd`,
 * que o cardápio aplica no carrinho de sempre (mesmo `addToCart`). Assim o
 * preço, os adicionais e o checkout continuam exatamente no caminho validado
 * pelo servidor — o chat é só uma forma mais fácil de escolher.
 *
 * Nunca é um beco sem saída: quando o texto não casa, o Pracinha oferece os
 * itens mais próximos como chips que o cliente toca e o item entra no carrinho
 * na hora. Escrever é opcional — dá para pedir só tocando.
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
  const [suggestions, setSuggestions] = useState<MenuProduct[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending, suggestions]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function pushAssistant(content: string) {
    setTurns((t) => [...t, { role: "assistant", content }]);
  }

  /** Chips tocáveis: o que casa com o texto; sem pista, os primeiros itens. */
  function offerItems(text: string) {
    const matches = suggestProducts(text, menu.products);
    setSuggestions(matches.length > 0 ? matches : menu.products.slice(0, 6));
  }

  async function submit(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    setTurns((t) => [...t, { role: "user", content }]);
    setInput("");
    setSending(true);
    let draft = null;
    try {
      draft = await draftOrder(restaurantId, content, menu);
    } finally {
      setSending(false);
    }
    if (!draft) {
      pushAssistant(
        "Não consegui falar com o cardápio agora. Toca num item abaixo ou tente de novo.",
      );
      offerItems(content);
      return;
    }
    pushAssistant(draft.reply);
    if (draft.lines.length > 0) {
      onAdd(draft.lines);
      setAdded((n) => n + draft.lines.reduce((s, l) => s + l.quantity, 0));
      setSuggestions([]);
    } else {
      // Nada casou: em vez de só recusar, oferece itens tocáveis.
      offerItems(content);
    }
  }

  /** Chip tocado = item no carrinho. O cliente pode pedir só tocando. */
  function pickProduct(product: MenuProduct) {
    onAdd([
      {
        product_id: product.id,
        quantity: 1,
        addon_ids: [],
        notes: "",
        name: product.name,
        addon_names: [],
      },
    ]);
    setAdded((n) => n + 1);
    pushAssistant(`Adicionei ${product.name} ao carrinho. Quer mais alguma coisa?`);
    inputRef.current?.focus();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[#0b0b12] shadow-2xl sm:rounded-[24px]">
        <header
          className="relative flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-5 py-4"
          style={{
            backgroundImage: `linear-gradient(135deg, ${hexToRgba(accent, 0.18)} 0%, transparent 65%)`,
          }}
        >
          <span
            className="grid size-10 shrink-0 place-items-center rounded-2xl text-black shadow-lg"
            style={{
              backgroundImage: `linear-gradient(140deg, ${accent} 0%, ${hexToRgba(accent, 0.7)} 100%)`,
            }}
          >
            <MessageCircle className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white">
              Pracinha <span className="font-normal text-gray-400">· pedir por chat</span>
            </p>
            <p className="text-[11px] text-gray-500">Escreve ou toca nos itens que eu monto</p>
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
              <p className="text-sm text-gray-300">
                Oi! Escreve o que você quer do jeito que falaria no balcão — ou toca num item. Eu
                monto o carrinho pra você conferir.
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
                  (t.role === "user" ? "bg-white/10 text-gray-300" : "text-black")
                }
                style={
                  t.role === "assistant" ? { backgroundColor: hexToRgba(accent, 0.9) } : undefined
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

          {suggestions.length > 0 && (
            <div className="space-y-2 pl-9">
              <p className="text-[11px] font-semibold text-gray-500">Toque para adicionar:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickProduct(p)}
                    className="flex items-center gap-1.5 rounded-full border bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-gray-200 transition-colors hover:text-white"
                    style={{ borderColor: hexToRgba(accent, 0.3) }}
                  >
                    <Plus className="size-3" style={{ color: accent }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {added > 0 && (
          <button
            type="button"
            onClick={onOpenCart}
            className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-black text-black animate-pop-in"
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
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex.: 2 x-burger sem cebola e um guaraná"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/25"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Enviar"
            className="grid size-10 shrink-0 place-items-center rounded-full text-black disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
