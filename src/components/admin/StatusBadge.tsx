import { cn } from "@/lib/utils";
import type { OrderStatus, RestaurantStatus } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/types";

const ORDER_DOT: Record<OrderStatus, string> = {
  received: "bg-sky-400",
  preparing: "bg-amber-400",
  ready: "bg-emerald-400",
  out_for_delivery: "bg-violet-400",
  delivered: "bg-zinc-400",
  cancelled: "bg-red-400",
};

const ORDER_PILL: Record<OrderStatus, string> = {
  received: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  preparing: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  ready: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  out_for_delivery: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  delivered: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
};

export function OrderStatusBadge({ status, size = "sm" }: { status: OrderStatus; size?: "sm" | "xs" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wide",
        ORDER_PILL[status],
        size === "xs" ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]",
      )}
    >
      <span className={cn("size-1.5 rounded-full", ORDER_DOT[status])} />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

const RESTAURANT_PILL: Record<RestaurantStatus, string> = {
  published: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  paused: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  draft: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
};

export function RestaurantStatusBadge({ status }: { status: RestaurantStatus }) {
  const label = status === "published" ? "PUBLICADO" : status === "paused" ? "PAUSADO" : "RASCUNHO";
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide", RESTAURANT_PILL[status])}>
      {label}
    </span>
  );
}
