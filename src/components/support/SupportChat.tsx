import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, Sparkles, User } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/AuthProvider";
import { sendSupportMessage, type SupportTurn } from "@/modules/supabase/ai";
import { COMPANY } from "@/lib/company";

/**
 * Chat de suporte do dono.
 *
 * Existe porque "quem me ajuda?" não tinha porta: o canal era um e-mail no
 * rodapé. Aqui o dono escreve o problema, recebe uma resposta na hora (IA) e o
 * relato é encaminhado por e-mail para o fornecedor — os dois caminhos ao mesmo
 * tempo, para nada ficar só na tela.
 *
 * A IA é opcional: sem token configurado a rota devolve um texto-guia e o
 * e-mail continua saindo. O chat nunca bloqueia a operação do restaurante.
 */

const SUGGESTIONS = [
  "Como instalo o app no celular?",
  "Meus pedidos não estão chegando",
  "Como funciona o plano Premium?",
];

export function SupportChat({
  open,
  onOpenChange,
  storeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId?: string;
}) {
  const { session } = useAuth();
  const [turns, setTurns] = useState<SupportTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notified, setNotified] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Rola para a última mensagem quando a conversa cresce — sem isso a resposta
  // nova aparece fora da vista e parece que o chat travou.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending]);

  async function submit(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    const next: SupportTurn[] = [...turns, { role: "user", content }];
    setTurns(next);
    setInput("");
    setSending(true);
    const res = await sendSupportMessage(next, session?.access_token, storeId);
    setSending(false);
    if (!res) {
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: `Não consegui responder agora. Tente de novo em instantes ou escreva para ${COMPANY.supportEmail}.`,
        },
      ]);
      return;
    }
    setNotified(res.notified);
    setTurns((t) => [...t, { role: "assistant", content: res.reply }]);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-white/10 bg-[#0b1120] p-0 sm:max-w-md"
      >
        <SheetTitle className="sr-only">Suporte</SheetTitle>
        <header className="relative overflow-hidden border-b border-white/[0.07] px-5 py-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-cyan-500/20 blur-3xl"
          />
          <div className="relative flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-black shadow-[0_8px_24px_rgba(6,182,212,0.35)]">
              <MessageCircle className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-white">Suporte Cidadela</p>
              <p className="flex items-center gap-1 text-[11px] text-cyan-300/80">
                <Sparkles className="size-3" /> Resposta na hora · relato vai por e-mail
              </p>
            </div>
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {turns.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Conta o que está acontecendo — eu respondo e, se precisar, encaminho para o time.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="tap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-gray-300 transition-colors hover:border-cyan-400/40 hover:text-white"
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
                  (t.role === "user" ? "bg-white/10 text-gray-300" : "bg-cyan-500/20 text-cyan-300")
                }
              >
                {t.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
              </span>
              <p
                className={
                  "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed " +
                  (t.role === "user"
                    ? "rounded-tr-sm bg-cyan-500 text-black"
                    : "rounded-tl-sm border border-white/[0.07] bg-white/[0.04] text-gray-200")
                }
              >
                {t.content}
              </p>
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="size-3.5 animate-spin" /> pensando…
            </div>
          )}

          {notified === true && turns.length > 0 && !sending && (
            <p className="text-center text-[11px] text-cyan-300/70">
              Seu relato foi encaminhado para o time. ✉️
            </p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex items-center gap-2 border-t border-white/[0.07] px-4 py-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva sua mensagem…"
            className="border-white/10 bg-white/[0.04] text-white placeholder:text-gray-600"
          />
          <Button
            type="submit"
            disabled={sending || !input.trim()}
            size="icon"
            className="shrink-0 rounded-full bg-gradient-to-r from-cyan-400 to-cyan-500 text-black"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
