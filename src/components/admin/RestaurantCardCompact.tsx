import { Store, ExternalLink, Pencil, Trash2, Eye, EyeOff, ImageIcon, UtensilsCrossed, ClipboardList, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  onEdit,
  onTogglePublish,
  onDelete,
  onManageMenu,
  onManageOrders,
  onSettings,
  toggling = false,
}: {
  restaurant: Restaurant;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  onManageMenu: () => void;
  onManageOrders: () => void;
  onSettings: () => void;
  toggling?: boolean;
}) {
  const isPublished = restaurant.status === "published";
  const cover = restaurant.banner_url || restaurant.logo_url || "";
  const hasImage = Boolean(cover);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-all hover:border-white/15 hover:bg-white/[0.05]">
      {/* cover */}
      <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-cyan-500/15 via-violet-500/10 to-transparent">
        {hasImage ? (
          <img
            src={cover}
            alt={restaurant.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white/80">
              {restaurant.logo_url ? <ImageIcon className="size-5" /> : <Store className="size-5" />}
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute left-2 top-2">
          <RestaurantStatusBadge status={restaurant.status} />
        </div>
        <div className="absolute right-2 top-2 flex gap-1">
          <a
            href={`/cardapio/${restaurant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="grid size-7 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
            aria-label="Abrir cardápio público"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
        {/* avatar overlapping */}
        <div className="absolute -bottom-5 left-3 flex size-10 items-center justify-center rounded-xl border border-white/10 bg-[#12121a] text-xs font-black text-white shadow-lg">
          {restaurant.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} className="size-10 rounded-xl object-cover" />
          ) : (
            <span>{initials(restaurant.name) || "•"}</span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-3 pb-3 pt-6">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold leading-tight text-white">{restaurant.name}</h3>
          <p className="truncate font-mono text-[11px] text-gray-500">/cardapio/{restaurant.slug}</p>
          {restaurant.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-400">{restaurant.description}</p>
          ) : (
            <p className="mt-1 text-xs italic text-gray-600">Sem descrição</p>
          )}
        </div>

        <div className="mt-auto flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" onClick={onEdit} className="h-7 rounded-full bg-white/10 px-3 text-xs text-white hover:bg-white/15">
            <Pencil className="size-3" /> Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onTogglePublish}
            disabled={toggling}
            className={`h-7 rounded-full border px-3 text-xs ${isPublished ? "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"}`}
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
              <Button size="sm" variant="ghost" className="h-7 rounded-full bg-white/[0.06] px-3 text-xs text-gray-300 hover:bg-white/10 hover:text-white">
                Mais
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-white/10 bg-[#1a1a22] text-gray-200">
              <DropdownMenuItem onClick={onManageMenu} className="gap-2 focus:bg-white/10 focus:text-white">
                <UtensilsCrossed className="size-3.5" /> Cardápio
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onManageOrders} className="gap-2 focus:bg-white/10 focus:text-white">
                <ClipboardList className="size-3.5" /> Pedidos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSettings} className="gap-2 focus:bg-white/10 focus:text-white">
                <Settings2 className="size-3.5" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={onEdit} className="gap-2 focus:bg-white/10 focus:text-white">
                <Pencil className="size-3.5" /> Editar dados
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="gap-2 text-red-300 focus:bg-red-500/15 focus:text-red-200">
                <Trash2 className="size-3.5" /> Excluir
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 focus:bg-white/10 focus:text-white">
                <Link to="/admin/compartilhar">Compartilhar</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
