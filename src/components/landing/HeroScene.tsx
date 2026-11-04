import { Bell, Check, UtensilsCrossed } from "lucide-react";

/**
 * Cena viva do herói: "o pedido chega".
 *
 * Em loop, um pedido nasce no cardápio do cliente (toque no item), atravessa e
 * cai no painel do dono como "Novo pedido". Conta a história do produto em
 * cinco segundos — sem vídeo, sem peso, sem mockup de celular. É a mesma ideia
 * do E2E do cardápio público: cliente pede, dono recebe.
 */
export function HeroScene({ className }: { className?: string }) {
  return (
    <div
      className={"relative mx-auto w-full max-w-[360px] select-none " + (className ?? "")}
      aria-hidden
      data-testid="hero-scene"
    >
      {/* Cliente: o cardápio */}
      <div className="relative z-10 w-[62%] rounded-2xl border border-white/10 bg-[#0b0b12] p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300">
            <UtensilsCrossed className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold text-white">Seu cardápio</p>
            <p className="text-[9px] text-gray-500">cliente no celular</p>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold text-gray-200">X-Burger</p>
            <p className="text-[9px] font-bold text-cyan-300">R$ 29,99</p>
          </div>
          <span className="relative grid size-6 shrink-0 place-items-center rounded-full bg-cyan-500 text-black">
            <Check className="size-3.5" />
            {/* O "toque" que o cliente dá. */}
            <span
              className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-cyan-300"
              style={{ animation: "hero-tap 5s ease-in-out infinite" }}
            />
          </span>
        </div>

        {/* O pedido que sai voando. */}
        <span
          className="pointer-events-none absolute -right-1 top-1/2 z-20 flex items-center gap-1 rounded-full bg-cyan-500 px-2 py-1 text-[9px] font-black text-black shadow-[0_0_20px_rgba(34,211,238,0.6)]"
          style={{ animation: "hero-fly 5s ease-in-out infinite" }}
        >
          <UtensilsCrossed className="size-3" /> Pedido
        </span>
      </div>

      {/* Painel do dono */}
      <div className="relative z-0 ml-auto mt-[-14%] w-[62%] rounded-2xl border border-white/10 bg-[#0b0b12] p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300">
            <Bell className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold text-white">Painel do dono</p>
            <p className="text-[9px] text-gray-500">recebe na hora</p>
          </div>
        </div>

        <div
          className="relative mt-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-2.5 py-2"
          style={{ animation: "hero-drop 5s ease-in-out infinite" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-emerald-300">Novo pedido</p>
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-bold text-emerald-200">
              #12
            </span>
          </div>
          <p className="mt-0.5 truncate text-[9px] text-gray-400">1× X-Burger · R$ 29,99</p>
          {/* Ping do alerta. */}
          <span
            className="pointer-events-none absolute -right-1 -top-1 size-3 rounded-full bg-emerald-400"
            style={{ animation: "hero-ping 5s ease-in-out infinite" }}
          />
        </div>
      </div>

      {/* Brilho de fundo da cena. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-cyan-500/10 blur-3xl"
      />
    </div>
  );
}
