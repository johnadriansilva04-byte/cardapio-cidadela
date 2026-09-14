import {
  Store,
  ExternalLink,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ImageIcon,
  ClipboardList,
  Settings2,
  LayoutGrid,
  ChevronRight,
  ChevronDown,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RestaurantStatusBadge } from "@/components/admin/StatusBadge";
import type { Restaurant } from "@/lib/types";
import { Link } from "@tanstack/react-router";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function RestaurantCardCompact({
  restaurant,
  menuItemCount = null,
  onOpen,
  onEdit,
  onTogglePublish,
  onDelete,
  onManageMenu,
  onManageOrders,
  onSettings,
  toggling = false,
}: {
  restaurant: Restaurant;
  menuItemCount?: number | null;
  onOpen?: () => void;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  onManageMenu?: () => void;
  onManageOrders: () => void;
  onSettings: () => void;
  toggling?: boolean;
}) {
  const isPublished = restaurant.status === "published";
  const cover = restaurant.banner_url || restaurant.logo_url || "";
  const hasImage = Boolean(cover);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (onOpen && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-all hover:border-cyan-500/30 hover:bg-white/[0.05] hover:shadow-[0_8px_30px_rgba(6,182,212,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
    >
      {/* cover */}
      <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-cyan-500/15 via-violet-500/10 to-transparent">
        {hasImage ? (
          <img
            src={cover}
            alt={restaurant.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white/80">
              {restaurant.logo_url ? (
                <ImageIcon className="size-5" />
              ) : (
                <Store className="size-5" />
              )}
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute left-2 top-2">
          <RestaurantStatusBadge status={restaurant.status} />
        </div>
        <div className="absolute right-2 top-2 flex gap-1">
          <a
            href={`/cardapio/${restaurant.slug}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="grid size-7 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
            aria-label="Abrir cardápio público"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
        {/* avatar overlapping */}
        <div className="absolute -bottom-8 left-3 z-10 flex size-16 items-center justify-center rounded-2xl border-2 border-[#12121a] bg-[#12121a] shadow-xl">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="size-16 rounded-2xl object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-sm font-black text-white/70">{initials(restaurant.name) || "•"}</span>
          )}
        </div>
      </div>

      {/* ─── CONTENT ─── */}
      <div className="flex flex-1 flex-col gap-1.5 px-3.5 pb-3 pt-10">
        {/* Name + chevron */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-bold leading-snug text-white group-hover:text-cyan-300 transition-colors">
            {restaurant.name}
          </h3>
          <ChevronRight className="size-4 shrink-0 text-gray-600 transition-all group-hover:translate-x-0.5 group-hover:text-cyan-400" />
        </div>

        {/* Description */}
        {restaurant.description ? (
          <p className="line-clamp-1 text-[11px] leading-relaxed text-gray-400">
            {restaurant.description}
          </p>
        ) : null}

        {/* Item count */}
        {menuItemCount !== null && (
          <p className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <LayoutGrid className="size-3" /> {menuItemCount} item{menuItemCount === 1 ? "" : "s"} no cardápio
          </p>
        )}

        {/* Action shortcuts */}
        <div className="mt-0.5 grid grid-cols-3 gap-1.5" onClick={(e) => e.stopPropagation()}>
          {onManageMenu && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onManageMenu}
              title="Gerenciar cardápio"
              className="h-8 gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 text-[11px] font-semibold text-emerald-300 hover:border-emerald-300/60 hover:bg-emerald-500/20 hover:text-emerald-200"
            >
              <UtensilsCrossed className="size-3.5" /> Cardápio
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onManageOrders}
            title="Gerenciar pedidos"
            className="h-8 gap-1 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 text-[11px] font-semibold text-amber-300 hover:border-amber-300/60 hover:bg-amber-500/20 hover:text-amber-200"
          >
            <ClipboardList className="size-3.5" /> Pedidos
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onSettings}
            title="Configurações do restaurante"
            className="h-8 gap-1 rounded-lg border border-sky-400/30 bg-sky-500/10 px-2 text-[11px] font-semibold text-sky-300 hover:border-sky-300/60 hover:bg-sky-500/20 hover:text-sky-200"
          >
            <Settings2 className="size-3.5" /> Config
          </Button>
        </div>

        {/* Publish toggle + more actions */}
        <div
          className="mt-1 flex items-center gap-1.5 border-t border-white/5 pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            variant="outline"
            onClick={onTogglePublish}
            disabled={toggling}
            className={`h-7 flex-1 gap-1 rounded-full border text-xs ${
              isPublished
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
            }`}
            title={isPublished ? "Despublicar restaurante" : "Publicar restaurante"}
          >
            {isPublished ? (
              <>
                <EyeOff className="size-3" /> Despublicar
              </>
            ) : (
              <>
                <Eye className="size-3" /> Publicar
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 rounded-full bg-white/[0.06] px-2.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white"
                title="Mais ações"
              >
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-white/10 bg-[#1a1a22] text-gray-200">
              <DropdownMenuItem onClick={onEdit} className="gap-2 focus:bg-white/10 focus:text-white">
                <Pencil className="size-3.5" /> Editar dados
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 focus:bg-white/10 focus:text-white">
                <Link to="/admin/compartilhar">Compartilhar</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="gap-2 text-red-300 focus:bg-red-500/15 focus:text-red-200">
                <Trash2 className="size-3.5" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
