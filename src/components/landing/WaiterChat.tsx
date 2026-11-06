import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, RotateCcw, Send, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg {
  id: number;
  role: "bot" | "user" | "system";
  text: string;
}

const SCRIPT: { q: string; a: string; resolve?: boolean }[] = [
  {
    q: "Como coloco meu cardápio no ar?",
    a: "Você cria a conta grátis, adiciona os itens com foto e preço e publica. Sai um link só seu e um QR Code pra pôr no status e no balcão. Leva uns 5 minutos.",
  },
  {
    q: "Quanto custa?",
    a: "Começa grátis com 5 pedidos por mês. Depois é a diária de R$ 1,99 por 24h, só quando cair pedido, ou o Premium ilimitado por R$ 28,99/mês (R$ 199,99/ano).",
  },
  {
    q: "Meus pedidos não estão chegando",
    a: "Já entendi. Vou verificar o alerta e a conexão da sua loja. Se não resolver, passo direto pro time de engenharia da Variant com o contexto da sua tela.",
    resolve: true,
  },
  {
    q: "Deu erro na tela de pedidos",
    a: "Obrigado por avisar. Capturei o erro com a página e o horário e enviei pro time com tudo que o dev precisa pra corrigir. Fico te avisando por aqui.",
    resolve: true,
  },
];

/**
 * Garçom virtual da landing — o Pracinha.
 *
 * Não chama IA nem backend: é um roteiro pré-escrito, animado, para o visitante
 * ver COMO o suporte responde. O ciclo se repete sozinho (digita → responde →
 * pausa → próxima pergunta); tocar numa pergunta salta para ela na hora.
 */
export function WaiterChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [idx, setIdx] = useState(0);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const next = (n: number) => (n + 1) % SCRIPT.length;

  useEffect(() => {
    if (paused) return;
    const step = SCRIPT[idx];
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    setTyping(true);
    timers.push(
      setTimeout(() => {
        if (cancelled) return;
        setTyping(false);
        setMessages((prev) => [...prev, { id: ++idRef.current, role: "user", text: step.q }]);
        setTyping(true);
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            setTyping(false);
            setMessages((prev) => {
              const added: Msg[] = [{ id: ++idRef.current, role: "bot", text: step.a }];
              if (step.resolve) {
                added.push({
                  id: ++idRef.current,
                  role: "system",
                  text: "Relato enviado para a engenharia da Variant com o contexto da tela.",
                });
              }
              return [...prev, ...added];
            });
            timers.push(
              setTimeout(() => {
                if (cancelled) return;
                setIdx((n) => next(n));
              }, 4200),
            );
          }, 1300),
        );
      }, 1100),
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [idx, paused]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  function ask(i: number) {
    setIdx(i);
    setMessages([]);
    idRef.current = 0;
    setPaused(false);
  }

  const active = useMemo(() => idx, [idx]);

  return (
    <div className="relative mx-auto w-full max-w-[400px]">
      <div
        aria-hidden
        className="animate-aurora absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-tr from-cyan-500/25 via-blue-500/10 to-violet-500/20 blur-3xl"
      />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#14141d] to-[#0a0a10] p-2.5 shadow-[0_40px_90px_-25px_rgba(6,182,212,0.45)]">
        <div className="overflow-hidden rounded-[1.6rem] border border-white/[0.06] bg-[#0b0b12]">
          <div className="relative border-b border-white/[0.07] px-4 py-3.5">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-cyan-500/20 blur-3xl"
            />
            <div className="relative flex items-center gap-2.5">
              <span className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-black shadow-[0_8px_24px_rgba(6,182,212,0.35)]">
                <Bot className="size-4" />
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#0b0b12] bg-emerald-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">
                  Pracinha <span className="font-normal text-gray-500">· Variant</span>
                </p>
                <p className="flex items-center gap-1 text-[10px] text-cyan-300/80">
                  <ShieldCheck className="size-2.5" /> Suporte oficial · resposta na hora
                </p>
              </div>
              <button
                type="button"
                onClick={() => ask(active)}
                className="hit-area grid size-7 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-white"
                aria-label="Reiniciar conversa"
              >
                <RotateCcw className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Progresso dos assuntos: mostra que a conversa anda, não só gira. */}
          <div className="h-0.5 w-full bg-white/[0.06]">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-700"
              style={{ width: `${((active + 1) / SCRIPT.length) * 100}%` }}
            />
          </div>

          <div
            ref={scrollRef}
            className="h-[212px] space-y-2.5 overflow-y-auto px-3 py-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {messages.length === 0 && (
              <p className="text-xs leading-relaxed text-gray-400">
                Oi! Sou o Pracinha, do time da Variant. Pergunte alguma coisa — ou toque num assunto
                abaixo.
              </p>
            )}
            {messages.map((m) =>
              m.role === "system" ? (
                <div
                  key={m.id}
                  className="animate-slide-up flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-2 text-[10px] text-emerald-200"
                >
                  <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
                  <span>{m.text}</span>
                </div>
              ) : (
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
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "bg-white/10 text-gray-300",
                    )}
                  >
                    {m.role === "bot" ? <Bot className="size-3" /> : <User className="size-3" />}
                  </span>
                  <p
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed",
                      m.role === "bot"
                        ? "rounded-tl-sm border border-white/[0.07] bg-white/[0.04] text-gray-200"
                        : "rounded-tr-sm bg-cyan-500 text-black",
                    )}
                  >
                    {m.text}
                  </p>
                </div>
              ),
            )}
            {typing && (
              <div className="flex items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cyan-500/20 text-cyan-300">
                  <Bot className="size-3" />
                </span>
                <span className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-white/[0.07] bg-white/[0.04] px-3 py-2.5">
                  <Dot d={0} />
                  <Dot d={150} />
                  <Dot d={300} />
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-white/[0.07] px-3 py-3">
            {SCRIPT.map((s, i) => (
              <button
                key={s.q}
                type="button"
                onClick={() => ask(i)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                  active === i
                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                    : "border-white/10 bg-white/[0.04] text-gray-400 hover:border-cyan-400/40 hover:text-white",
                )}
              >
                {s.q}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-500">
        <Send className="size-3" /> É assim que o suporte responde — dentro do seu painel.
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
