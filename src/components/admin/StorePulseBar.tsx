import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, LayoutGrid, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { isOpenNow, normalizeOperatingHours } from "@/lib/operatingHours";
import type { Restaurant } from "@/lib/types";

interface StorePulseBarProps {
  restaurant: Restaurant;
  toggling: boolean;
  onToggle: () => void;
}

/**
 * Pulso da loja: estado (publicado / pausado / aberto agora) e as duas ações
 * que o dono repete todo dia — pausar a loja e copiar o link do cardápio.
 */
export function StorePulseBar({ restaurant, toggling, onToggle }: StorePulseBarProps) {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Relógio leve: o rótulo "Aberto/Fechado" acompanha a hora, sem recarregar.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const published = restaurant.status === "published";
  const open = useMemo(
    () => isOpenNow(normalizeOperatingHours(restaurant.operating_hours), now),
    [restaurant.operating_hours, now],
  );

  const publicUrl = useMemo(() => {
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://cardapio-cidadela.vercel.app";
    return `${base}/cardapio/${restaurant.slug}`;
  }, [restaurant.slug]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      /* clipboard bloqueado — o link continua visível para cópia manual */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const tone = !published
    ? { dot: "bg-gray-500", text: "text-gray-400", label: "Pausado" }
    : open
      ? { dot: "bg-emerald-400 animate-pulse", text: "text-emerald-300", label: "Aberto agora" }
      : { dot: "bg-amber-400", text: "text-amber-300", label: "Fechado agora" };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300">
        <Power className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{restaurant.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px]">
          <span className={cn("size-1.5 rounded-full", tone.dot)} />
          <span className={tone.text}>{tone.label}</span>
          <span className="text-gray-600">•</span>
          <span className="truncate font-mono text-gray-500">/cardapio/{restaurant.slug}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={copyLink}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors",
            copied
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white",
          )}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copiado" : "Link"}
        </button>

        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="grid size-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-gray-300 transition-colors hover:bg-white/[0.08] hover:text-white"
          title="Abrir cardápio"
        >
          <ExternalLink className="size-3.5" />
        </a>

        <button
          type="button"
          onClick={onToggle}
          disabled={toggling}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50",
            published
              ? "border border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white"
              : "bg-cyan-500 text-black hover:bg-cyan-400",
          )}
        >
          <Power className="size-3" />
          {toggling ? "..." : published ? "Pausar" : "Publicar"}
        </button>

        <Link
          to="/admin/restaurante/$id"
          params={{ id: restaurant.id }}
          search={{ tab: undefined }}
          className="grid size-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-gray-300 transition-colors hover:bg-white/[0.08] hover:text-white"
          title="Abrir gestão"
        >
          <LayoutGrid className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
