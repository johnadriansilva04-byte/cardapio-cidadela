import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, Minus, Plus, Send, Star } from "lucide-react";
import { brl, cn } from "@/lib/utils";
import { SmartImage } from "@/components/ui/SmartImage";
import {
  getLandingDemoStore,
  type DemoMenuItem,
  type DemoStoreMenu,
} from "@/modules/supabase/landing-demo";
import { DEMO_SNAPSHOT } from "@/components/landing/landing-data";

/**
 * O cardápio REAL, interativo — é isto que o cliente do restaurante vê.
 *
 * Carrega a loja de verdade (a mesma da vitrine) e deixa o visitante montar um
 * pedido: adicionar, remover e "enviar". Não grava nada — é demonstração. Na
 * landing ele só aparece DENTRO do botão "ver cardápio real", não solto na
 * página.
 */
export function LiveStoreDemo({ className }: { className?: string }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sent, setSent] = useState(false);
  const [store, setStore] = useState<DemoStoreMenu>(DEMO_SNAPSHOT);
  const [activeCat, setActiveCat] = useState<string>(DEMO_SNAPSHOT.categories[0].id);

  useEffect(() => {
    let alive = true;
    getLandingDemoStore().then((real) => {
      if (!alive || !real) return;
      setStore(real);
      setActiveCat((prev) =>
        real.categories.some((c) => c.id === prev) ? prev : real.categories[0].id,
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  const items: DemoMenuItem[] = store.items;
  const visibleItems = useMemo(
    () => items.filter((i) => i.categoryId === activeCat),
    [items, activeCat],
  );

  const { count, total } = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const item of items) {
      const qty = cart[item.id] ?? 0;
      count += qty;
      total += qty * item.price;
    }
    return { count, total };
  }, [cart, items]);

  function add(id: string) {
    setSent(false);
    setCart((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  function remove(id: string) {
    setSent(false);
    setCart((prev) => {
      const next = { ...prev };
      if ((next[id] ?? 0) <= 1) delete next[id];
      else next[id] -= 1;
      return next;
    });
  }

  return (
    <div className={cn("relative mx-auto w-full max-w-[380px]", className)}>
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#14141d] to-[#0a0a10] shadow-[0_40px_90px_-25px_rgba(6,182,212,0.45)]">
        <div className="relative overflow-hidden rounded-[2rem]">
          <div className="relative mt-2 px-3">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/25 via-blue-500/10 to-violet-500/20 p-3">
              <div
                aria-hidden
                className="absolute -right-6 -top-8 size-24 rounded-full bg-cyan-400/30 blur-2xl"
              />
              <div className="relative flex items-center gap-2.5">
                <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#0b0b12] text-xl ring-1 ring-white/10">
                  {store.logoUrl ? (
                    <SmartImage
                      src={store.logoUrl}
                      alt={store.name}
                      width={88}
                      height={88}
                      className="size-full"
                      imgClassName="size-full object-cover"
                      eager
                      fallback={<span>🍔</span>}
                    />
                  ) : (
                    <span>🍔</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-black text-white">
                    {store.name} <BadgeCheck className="size-3.5 shrink-0 text-cyan-300" />
                  </p>
                  <p className="flex items-center gap-1.5 text-[10px] text-gray-300">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Aberto
                    agora
                    <span className="text-gray-600">•</span>
                    <Star className="size-3 fill-amber-300 text-amber-300" /> 4,9
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {store.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCat(cat.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition-colors",
                  activeCat === cat.id
                    ? "bg-cyan-500 text-black"
                    : "bg-white/[0.06] text-gray-400 hover:text-white",
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="mt-2.5 max-h-[46vh] min-h-[220px] space-y-2 overflow-y-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleItems.map((item) => {
              const qty = cart[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-2xl border p-2 transition-all",
                    qty > 0
                      ? "border-cyan-500/40 bg-cyan-500/[0.07]"
                      : "border-white/[0.06] bg-white/[0.02]",
                  )}
                >
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[0.05] text-xl">
                    {item.imageUrl ? (
                      <SmartImage
                        src={item.imageUrl}
                        alt={item.name}
                        width={96}
                        height={96}
                        resize="cover"
                        className="size-full"
                        imgClassName="size-full object-cover"
                        fallback={<span>{item.emoji ?? "🍽️"}</span>}
                      />
                    ) : (
                      <span>{item.emoji ?? "🍽️"}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-xs font-bold text-white">
                      {item.name}
                      {item.tag && (
                        <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-300">
                          {item.tag}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[10px] text-gray-500">{item.description}</p>
                    <p className="text-[11px] font-black text-cyan-300">{brl(item.price)}</p>
                  </div>
                  {qty > 0 ? (
                    <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
                      <button
                        type="button"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => remove(item.id)}
                        className="grid size-7 place-items-center rounded-md text-gray-300 transition-colors hover:bg-white/10"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-4 text-center text-xs font-black text-white">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Adicionar ${item.name}`}
                        onClick={() => add(item.id)}
                        className="grid size-7 place-items-center rounded-md bg-cyan-500 text-black transition-colors hover:bg-cyan-400"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Adicionar ${item.name}`}
                      onClick={() => add(item.id)}
                      className="grid size-8 shrink-0 place-items-center rounded-xl bg-cyan-500 text-black transition-transform hover:scale-110"
                    >
                      <Plus className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 border-t border-white/[0.06] bg-black/40 px-3 pb-4 pt-3">
            {sent ? (
              <div className="animate-pop-in flex items-center gap-2.5 py-1">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
                  <Check className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">Pedido enviado!</p>
                  <p className="text-[11px] text-gray-400">
                    Chegou no painel do restaurante na hora.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>{count === 0 ? "Toque nos itens acima" : `${count} item(ns)`}</span>
                  <span className="text-base font-black text-white">{brl(total)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (count === 0) return;
                    setSent(true);
                    setCart({});
                  }}
                  disabled={count === 0}
                  className="sheen mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-500 py-2.5 text-xs font-black text-black transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="size-3.5" /> Enviar pedido
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
