import { useEffect, useState } from "react";
import { Bot, Radio, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  bot?: string;
  user?: string;
}

interface Scene {
  type: string;
  title: string;
  subtitle: string;
  steps: Step[];
}

/**
 * Roteiro do outdoor: cada cena mostra um pedaço do produto (o problema, a
 * montagem por conversa, o garçom digital, o preço). É vitrine — sem backend.
 */
const SCENES: Scene[] = [
  {
    type: "problema",
    title: "Por que a Variant existe",
    subtitle: "Comissão de 23–30% quebra o pequeno negócio",
    steps: [
      { bot: "Eu sou o Pracinha. A Variant existe porque 80% dos restaurantes fecham em 3 anos." },
      { bot: "Não é falta de cliente. É a comissão de 23–30% dos apps comendo a sua margem." },
      { bot: "Pizza de R$ 50: você recebe R$ 30. Margem de 3–5% é prejuízo silencioso." },
      {
        bot: "Aqui é zero comissão. Você paga só quando tiver movimento — e a margem volta pra você.",
      },
    ],
  },
  {
    type: "montagem",
    title: "Monte conversando",
    subtitle: "Sem formulário de 20 campos",
    steps: [
      { bot: "Vamos começar! Qual é o nome do seu restaurante?" },
      { user: "Variant Burger" },
      { bot: "Boa! Qual WhatsApp vai receber os pedidos?" },
      { user: "(48) 99999-9999" },
      { bot: "Pronto: 3 categorias e 8 itens criados. Quer ajustar algum preço?" },
    ],
  },
  {
    type: "pedido",
    title: "Garçom digital",
    subtitle: "Responde na hora, dentro do painel",
    steps: [
      { user: "Quanto custa o X-Burger?" },
      { bot: "R$ 29,00, com cheddar fresco." },
      { user: "Quero um com cebola" },
      { bot: "Anotei: X-Burger com cebola. Mais alguma coisa?" },
      { bot: "Pedido na cozinha! Total: R$ 29,00." },
    ],
  },
  {
    type: "preco",
    title: "Pague só quando usar",
    subtitle: "Diária, Mensal ou Anual",
    steps: [
      { bot: "A diária libera 24h por R$ 1,99 — só nos dias que você abrir." },
      { user: "E se eu abrir todo dia?" },
      { bot: "Aí o Premium ilimitado sai mais barato que a diária todo dia." },
      { user: "Tem leitura de cardápio por foto?" },
      { bot: "Tem — no plano Anual. Você manda a foto e eu monto o cardápio." },
    ],
  },
];

/** Fio de lâmpadas: a "luz de Natal" que emoldura o outdoor. */
function LightString({
  count,
  colors,
  chase = false,
  className,
}: {
  count: number;
  colors: string[];
  chase?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none flex items-center justify-between", className)}
    >
      {Array.from({ length: count }, (_, i) => {
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            className={cn("size-1.5 rounded-full sm:size-2", chase ? "bulb-chase" : "fairy-bulb")}
            style={{
              backgroundColor: color,
              boxShadow: `0 0 8px 1.5px ${color}`,
              animationDelay: `${(i % 6) * 0.22}s`,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * O outdoor da home — uma tela em estrutura de verdade.
 *
 * Antes era uma "moldura de gravação de tela" em cima de um poste fino: parecia
 * print de app, não um painel. Agora tem estrutura (travessa, colunas, base),
 * emoldurado por um fio de lâmpadas — a luz de Natal no fim do ano, ciano fora
 * dele. A tela por dentro é o Pracinha atendendo, cena a cena.
 */
export function OutdoorBillboard({ christmas = false }: { christmas?: boolean }) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const scene = SCENES[sceneIndex];
  const step = scene.steps[stepIndex];

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setStepIndex((prev) => {
          const next = prev + 1;
          if (next >= scene.steps.length) {
            setSceneIndex((s) => (s + 1) % SCENES.length);
            return 0;
          }
          return next;
        });
        setVisible(true);
      }, 900);
    }, 6500);
    return () => clearInterval(id);
  }, [scene.steps.length]);

  const bulbs = christmas ? ["#ef4444", "#22c55e", "#facc15"] : ["#22d3ee", "#818cf8", "#f472b6"];

  return (
    <figure className="relative mx-auto w-full max-w-xl">
      {/* Halo atrás da peça */}
      <div
        aria-hidden
        className={cn(
          "animate-aurora absolute -inset-8 -z-10 rounded-[3rem] blur-3xl",
          christmas
            ? "bg-gradient-to-tr from-red-500/25 via-emerald-500/10 to-amber-500/20"
            : "bg-gradient-to-tr from-cyan-500/25 via-transparent to-violet-500/20",
        )}
      />

      {/* Travessa superior com as lâmpadas */}
      <div className="relative mx-auto flex h-4 w-[86%] items-center justify-center rounded-full bg-gradient-to-b from-zinc-600 via-zinc-700 to-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
        <LightString count={16} colors={bulbs} chase className="absolute inset-x-3 -top-1.5" />
      </div>

      {/* Colunas da estrutura */}
      <div aria-hidden className="mx-auto flex w-[86%] justify-between">
        <span className="h-6 w-1.5 rounded-b bg-gradient-to-b from-zinc-700 to-zinc-800" />
        <span className="h-6 w-1.5 rounded-b bg-gradient-to-b from-zinc-700 to-zinc-800" />
      </div>

      {/* Moldura da tela */}
      <div className="relative rounded-[2rem] border-[6px] border-zinc-800/90 bg-gradient-to-b from-zinc-800 to-zinc-950 p-3 shadow-[0_50px_100px_-30px_rgba(0,0,0,0.85)]">
        {/* Parafusos dos cantos */}
        {["left-2 top-2", "right-2 top-2", "bottom-2 left-2", "bottom-2 right-2"].map((pos) => (
          <span
            key={pos}
            aria-hidden
            className={cn(
              "absolute size-1.5 rounded-full bg-zinc-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]",
              pos,
            )}
          />
        ))}

        {/* Fio de luzes interno, rente à tela */}
        <LightString count={14} colors={bulbs} className="mb-2 px-1" />

        {/* A TELA */}
        <div className="relative aspect-[16/10] overflow-hidden rounded-[1.4rem] border border-white/[0.06] bg-gradient-to-br from-[#0e1016] via-[#0b0b12] to-[#080810]">
          <div
            aria-hidden
            className="animate-aurora absolute inset-0 bg-gradient-to-br from-cyan-500/[0.06] via-transparent to-violet-500/[0.06]"
          />
          {/* Linha de varredura: dá a sensação de painel ligado */}
          <div
            aria-hidden
            className="animate-scan pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.05] to-transparent"
          />

          <div className="relative flex h-full flex-col">
            {/* Cabeçalho da tela */}
            <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2 sm:px-4 sm:py-2.5">
              <span className="relative grid size-6 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-black sm:size-7">
                <Bot className="size-3.5" />
                <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-[#0b0b12] bg-emerald-400" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold text-white sm:text-xs">
                  Pracinha <span className="font-normal text-gray-500">· Variant</span>
                </span>
                <span className="block truncate text-[9px] text-cyan-300/80 sm:text-[10px]">
                  atendendo agora
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-300">
                <Radio className="size-2.5 animate-pulse" /> ao vivo
              </span>
            </div>

            {/* Conversa */}
            <div className="flex-1 space-y-2 overflow-hidden px-3 py-3 sm:px-4">
              {scene.steps.slice(0, stepIndex + 1).map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "transition-opacity",
                    i === stepIndex ? "opacity-100" : "opacity-45",
                  )}
                >
                  {msg.user && (
                    <div className="flex justify-end">
                      <p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-cyan-500 px-3 py-1.5 text-[11px] font-semibold text-black">
                        {msg.user}
                      </p>
                    </div>
                  )}
                  {msg.bot && (
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-cyan-500/20 text-cyan-300">
                        <Bot className="size-3" />
                      </span>
                      <p className="max-w-[82%] rounded-2xl rounded-tl-sm border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-[11px] leading-relaxed text-gray-200">
                        {msg.bot}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {!visible && (
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-cyan-500/20 text-cyan-300">
                    <Bot className="size-3" />
                  </span>
                  <span className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-white/[0.07] bg-white/[0.04] px-3 py-2">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="size-1.5 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: `${d}ms`, animationDuration: "900ms" }}
                      />
                    ))}
                  </span>
                </div>
              )}
            </div>

            {/* Legenda do outdoor (marquee) */}
            <div className="flex items-center gap-2 border-t border-white/[0.07] bg-black/40 px-3 py-2 sm:px-4">
              <Sparkles className="size-3.5 shrink-0 text-amber-300" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-black text-white">
                  {scene.title}
                </span>
                <span className="block truncate text-[10px] text-gray-400">{scene.subtitle}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {SCENES.map((s, i) => (
                  <span
                    key={s.type}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === sceneIndex ? "w-4 bg-cyan-400" : "w-1.5 bg-white/20",
                    )}
                  />
                ))}
              </span>
            </div>
          </div>
        </div>

        {/* Fio de luzes interno, embaixo */}
        <LightString count={14} colors={bulbs} className="mt-2 px-1" />
      </div>

      {/* Base da estrutura */}
      <div aria-hidden className="relative mx-auto w-[70%]">
        <div className="mx-auto flex justify-between px-8">
          <span className="h-8 w-2 rounded-b bg-gradient-to-b from-zinc-700 to-zinc-800" />
          <span className="h-8 w-2 rounded-b bg-gradient-to-b from-zinc-700 to-zinc-800" />
        </div>
        <div className="mx-auto h-2 w-40 rounded-full bg-gradient-to-b from-zinc-700 to-zinc-900 shadow-lg" />
      </div>

      <figcaption className="mt-3 text-center text-[11px] text-gray-500">
        O garçom digital responde na hora — é assim que o suporte fala com você.
      </figcaption>
    </figure>
  );
}
