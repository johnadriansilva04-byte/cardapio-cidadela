import { useMemo, useState } from "react";
import { Bell, BellOff, Check, ChevronDown, Crown, PartyPopper, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateRestaurant } from "@/modules/supabase/restaurants";
import type { Restaurant } from "@/lib/types";
import {
  buildSeasonalOffer,
  getActiveThemes,
  inferNiche,
  SEASONAL_THEMES,
  type SeasonalTheme,
} from "@/lib/seasonalThemes";
import {
  loadSeasonalPrefs,
  markThemeAdopted,
  markThemeDismissed,
  setSeasonalEnabled,
  shouldOfferTheme,
  type SeasonalPrefs,
} from "@/lib/seasonalPrefs";

/**
 * "Vista seu cardápio para a data" — o aviso sazonal do painel.
 *
 * No mês do feriado o Pracinha avisa o dono e oferece adotar o tema com um
 * toque (o cardápio veste as cores da data sozinho). Fora da janela, o card
 * some; o dono pode abrir a lista completa quando quiser. As decisões
 * (adotado / dispensado no ano / avisos desligados) ficam no dispositivo, então
 * o aviso não insiste depois de respondido.
 */
export function SeasonalThemesCard({
  restaurant,
  canUse = false,
  onUpgrade,
}: {
  restaurant: Restaurant | null;
  /** `true` quando o dono tem o ciclo ANUAL — a modalidade é exclusiva dele. */
  canUse?: boolean;
  /** Leva ao fluxo de assinatura (upsell do anual). */
  onUpgrade?: () => void;
}) {
  const [prefs, setPrefs] = useState<SeasonalPrefs>(() => loadSeasonalPrefs());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const year = new Date().getFullYear();
  const active = useMemo(() => getActiveThemes(), []);
  const niche = useMemo(
    () => inferNiche(`${restaurant?.name ?? ""} ${restaurant?.description ?? ""}`),
    [restaurant?.name, restaurant?.description],
  );

  const current = active[0] ?? null;
  const currentOffer = current ? buildSeasonalOffer(niche, current) : null;
  const notify =
    prefs.enabled && current !== null && shouldOfferTheme(current.key, year, prefs) && !!restaurant;

  async function adopt(theme: SeasonalTheme) {
    if (!restaurant) return;
    if (!canUse) {
      onUpgrade?.();
      return;
    }
    setSaving(true);
    const ok = await updateRestaurant(restaurant.id, {
      primary_color: theme.primary,
      secondary_color: theme.secondary,
    });
    setSaving(false);
    if (!ok) {
      toast.error("Não deu para aplicar o tema agora. Tente de novo.");
      return;
    }
    setPrefs(markThemeAdopted(theme.key));
    toast.success(`Cardápio vestido para ${theme.name}! 🎉`, {
      description: "Cor aplicada. Dá para ajustar em Restaurantes quando quiser.",
    });
  }

  function dismiss(theme: SeasonalTheme) {
    setPrefs(markThemeDismissed(theme.key, year));
    toast(`Tudo bem — não aviso mais sobre ${theme.name} este ano.`);
  }

  function toggleEnabled() {
    const next = setSeasonalEnabled(!prefs.enabled);
    setPrefs(next);
    toast(next.enabled ? "Avisos de datas comemorativas ligados." : "Avisos desligados.");
  }

  // Fora de qualquer janela e com o painel fechado: só o atalho discreto.
  if (!notify && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-left text-xs text-gray-400 transition-colors hover:border-white/15 hover:bg-white/[0.04]"
      >
        <PartyPopper className="size-4 text-amber-300" />
        <span className="flex-1">Datas comemorativas: vista o cardápio para o próximo feriado</span>
        <ChevronDown className="size-4" />
      </button>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: current ? `${current.primary}55` : "rgba(255,255,255,0.08)",
        background: current
          ? `linear-gradient(135deg, ${current.primary}1f, transparent 65%)`
          : "rgba(255,255,255,0.02)",
      }}
    >
      {current && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full blur-3xl"
          style={{ background: `${current.secondary}33` }}
        />
      )}
      <div className="relative">
        <div className="flex items-start gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-xl text-xl shadow-lg"
            style={{ background: current?.primary ?? "#334155", color: "#0b0b12" }}
          >
            {current?.emoji ?? "📅"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              <Bell className="size-3" /> Data comemorativa
            </p>
            <p className="font-display text-base font-black leading-tight text-white">
              {current ? `${currentOffer?.title} chegou` : "Datas comemorativas"}
            </p>
            <p className="mt-0.5 text-xs text-gray-300">
              {current
                ? `${current.headline}. Um toque veste o cardápio com as cores e as ideias de ${current.name}.`
                : "Escolha um feriado e vista o cardápio na hora — sem configurar nada."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Recolher" : "Ver todas as datas"}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            {open ? <X className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>

        {currentOffer && current && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {currentOffer.menuIdeas.slice(0, 4).map((idea) => (
              <span
                key={idea}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-gray-200"
              >
                {idea}
              </span>
            ))}
          </div>
        )}

        {notify && current && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={saving}
              onClick={() => adopt(current)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-black transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              style={{ background: current.primary }}
            >
              {canUse ? (
                <>
                  <Sparkles className="size-4" /> Vestir meu cardápio de {current.name}
                </>
              ) : (
                <>
                  <Crown className="size-4" /> Vestir de {current.name} (plano Anual)
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => dismiss(current)}
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-gray-300 transition-colors hover:bg-white/5"
            >
              Agora não
            </button>
          </div>
        )}

        {!canUse && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-200/90">
            <Crown className="size-3" /> Temas de datas comemorativas são exclusivos do plano Anual.
          </p>
        )}

        {open && (
          <div className="mt-4 border-t border-white/[0.07] pt-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {SEASONAL_THEMES.map((t) => {
                const isActive = active.includes(t);
                const isAdopted = prefs.adopted.includes(t.key);
                return (
                  <div
                    key={t.key}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border p-2.5",
                      isActive
                        ? "border-white/20 bg-white/[0.05]"
                        : "border-white/[0.06] bg-white/[0.02]",
                    )}
                  >
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-lg"
                      style={{ background: `${t.primary}22`, color: t.primary }}
                    >
                      {t.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-white">{t.name}</span>
                      <span className="block truncate text-[10px] text-gray-500">
                        {isActive ? "Valendo agora" : t.headline}
                      </span>
                    </span>
                    {isAdopted ? (
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
                        <Check className="size-3.5" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={saving || !restaurant}
                        onClick={() => adopt(t)}
                        className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                      >
                        Usar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={toggleEnabled}
              className="mt-3 flex items-center gap-2 text-[11px] text-gray-400 transition-colors hover:text-white"
            >
              {prefs.enabled ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
              {prefs.enabled
                ? "Avisos de datas comemorativas ligados — toque para desligar"
                : "Avisos desligados — toque para ligar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
