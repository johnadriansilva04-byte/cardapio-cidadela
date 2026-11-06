import { useState } from "react";
import { Check, LayoutTemplate, Sparkles } from "lucide-react";
import { brl, cn } from "@/lib/utils";
import { MENU_TEMPLATES, type MenuTemplate } from "@/components/landing/landing-data";

/**
 * Templates prontos — o dono não começa do zero.
 *
 * Escolhe um tema (hamburgueria, pizzaria, açaí...) e vê o cardápio daquele
 * ramo na hora, já na cor certa. As cores são as mesmas do `COLOR_PRESETS` que
 * o `RestaurantChatWizard` aplica de verdade, então o preview não engana.
 */
export function TemplateGallery() {
  const [active, setActive] = useState<MenuTemplate>(MENU_TEMPLATES[0]);

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      {/* Lista de temas */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
        {MENU_TEMPLATES.map((t) => {
          const on = t.key === active.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-3 text-left transition-all",
                on
                  ? "border-white/25 bg-white/[0.06]"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]",
              )}
              style={on ? { boxShadow: `0 12px 40px -18px ${t.primary}` } : undefined}
            >
              <span
                aria-hidden
                className="absolute -right-6 -top-6 size-16 rounded-full opacity-60 blur-2xl"
                style={{ background: t.primary }}
              />
              <span className="relative flex items-center gap-2">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-lg"
                  style={{ background: `${t.primary}22`, color: t.primary }}
                >
                  {t.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-white">{t.name}</span>
                  <span className="flex gap-1 pt-0.5">
                    <span className="size-2.5 rounded-full" style={{ background: t.primary }} />
                    <span className="size-2.5 rounded-full" style={{ background: t.secondary }} />
                  </span>
                </span>
                {on && (
                  <span
                    className="absolute right-0 top-0 grid size-4 place-items-center rounded-full text-black"
                    style={{ background: t.primary }}
                  >
                    <Check className="size-2.5" />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Preview do tema escolhido */}
      <div
        className="relative overflow-hidden rounded-[2rem] border border-white/10 p-5 transition-colors sm:p-7"
        style={{
          background: `linear-gradient(150deg, ${active.primary}1f, transparent 60%)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full blur-3xl transition-colors"
          style={{ background: `${active.secondary}33` }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span
              className="grid size-12 place-items-center rounded-2xl text-2xl shadow-lg"
              style={{ background: active.primary, color: "#0b0b12" }}
            >
              {active.emoji}
            </span>
            <div>
              <p className="font-display text-lg font-black text-white">{active.name}</p>
              <p className="text-xs text-gray-400">{active.tagline}</p>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {active.items.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-2.5 backdrop-blur-sm"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-xl">
                  {item.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white">{item.name}</span>
                  <span className="block text-[11px] text-gray-500">Pronto em ~15 min</span>
                </span>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-xs font-black"
                  style={{ background: `${active.primary}22`, color: active.primary }}
                >
                  {brl(item.price)}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="sheen mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-black text-black transition-transform hover:-translate-y-0.5"
            style={{ background: active.primary }}
          >
            <LayoutTemplate className="size-4" /> Usar o tema {active.name}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
            <Sparkles className="size-3" /> Começa assim e muda cor, foto e preço depois — quando
            quiser.
          </p>
        </div>
      </div>
    </div>
  );
}
