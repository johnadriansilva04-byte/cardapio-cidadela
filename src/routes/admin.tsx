import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  UtensilsCrossed,
  LayoutDashboard,
  Store,
  Sandwich,
  ClipboardList,
  Wallet,
  Share2,
  Settings,
  ChevronLeft,
  Menu,
  X,
  LogOut,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getRestaurantsByOwner, ensureRestaurantsForUser } from "@/modules/supabase/restaurants";
import { subscribeToOrders } from "@/modules/supabase/orders";
import { supabase } from "@/modules/supabase/client";
import { playNewOrderAlert, requestOrderNotificationPermission } from "@/lib/orderAlertSound";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Painel — Cardápio Cidadela" }],
  }),
  component: AdminLayout,
});

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/restaurantes", label: "Restaurantes", icon: Store },
  { to: "/admin/cardapio", label: "Cardápio", icon: Sandwich },
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/admin/compartilhar", label: "Compartilhar", icon: Share2 },
  { to: "/admin/config", label: "Configurações", icon: Settings },
] as const;

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const matchRoute = useMatchRoute();
  const { isAuthenticated, loading, signOut, user } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = "/login?returnTo=%2Fadmin";
    }
  }, [loading, isAuthenticated]);

  useEffect(() => {
    requestOrderNotificationPermission();
  }, []);

  // Badge + som: conta pedidos ativos (received/preparing/ready/out_for_delivery) e toca alerta em INSERT
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setPendingCount(0);
      return;
    }
    const channels: RealtimeChannel[] = [];
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const fetchPending = async () => {
      try {
        const rests = await getRestaurantsByOwner(user.id);
        if (cancelled) return;
        if (rests.length === 0) {
          setPendingCount(0);
          return;
        }
        const ids = rests.map((r) => r.id);
        const { data, error } = await supabase
          .from("orders")
          .select("id,status")
          .in("restaurant_id", ids)
          .in("status", ["received", "preparing", "ready", "out_for_delivery"]);
        if (cancelled) return;
        if (error) {
          console.error("[admin badge] fetch", error);
          return;
        }
        setPendingCount(data?.length ?? 0);
      } catch {
        /* ignore */
      }
    };

    const scheduleFetch = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(fetchPending, 380);
    };

    (async () => {
      try {
        await ensureRestaurantsForUser(user);
        if (cancelled) return;
        await fetchPending();
        if (cancelled) return;
        const rests = await getRestaurantsByOwner(user.id);
        if (cancelled) return;
        for (const r of rests) {
          try {
            const ch = subscribeToOrders(r.id, (eventType, order) => {
              if (eventType === "INSERT") {
                if (["received", "preparing", "ready", "out_for_delivery"].includes(order.status)) {
                  setPendingCount((c) => c + 1);
                }
                playNewOrderAlert();
                if (
                  typeof window !== "undefined" &&
                  "Notification" in window &&
                  Notification.permission === "granted"
                ) {
                  try {
                    new Notification("🔔 Novo pedido!", {
                      body: `${order.customer_name} — ${order.comanda} • R$ ${Number(order.total).toFixed(2)}`,
                    });
                  } catch {
                    /* ignore */
                  }
                }
                const orig = document.title;
                document.title = `🔔 NOVO PEDIDO! ${order.comanda}`;
                setTimeout(() => {
                  if (!cancelled) document.title = orig;
                }, 4200);
              } else if (eventType === "UPDATE" || eventType === "DELETE") {
                scheduleFetch();
              }
            });
            if (ch) channels.push(ch);
          } catch {
            /* ignore per-restaurant realtime failure */
          }
        }
      } catch {
        /* ignore global realtime failure */
      }
    })();

    poll = setInterval(fetchPending, 15000);

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      if (poll) clearInterval(poll);
      for (const ch of channels) {
        try {
          supabase.removeChannel(ch);
        } catch {
          /* ignore */
        }
      }
    };
  }, [isAuthenticated, user]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="size-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-[#0a0a0f]">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0c0c14] lg:flex">
        <SidebarContent pendingCount={pendingCount} onNavigate={() => setSidebarOpen(false)} />
      </aside>

      {/* Sidebar mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-white/[0.06] bg-[#0c0c14] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <Link to="/" className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/10">
                  <UtensilsCrossed className="size-4 text-cyan-400" />
                </span>
                <span className="text-sm font-bold">
                  Cardápio <span className="text-cyan-400">Cidadela</span>
                </span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Fechar menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <SidebarContent pendingCount={pendingCount} onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-white/[0.06] bg-[#0a0a0f]/80 px-4 py-3 backdrop-blur lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="grid size-9 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-300"
          >
            <ChevronLeft className="size-3.5" />
            Voltar ao site
          </Link>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  pendingCount = 0,
  onNavigate,
}: {
  pendingCount?: number;
  onNavigate?: () => void;
}) {
  const matchRoute = useMatchRoute();
  const { signOut, user } = useAuth();

  const displayName = (user?.user_metadata?.name as string) || user?.email || user?.phone || "";

  function isActive(itemTo: string): boolean {
    if (itemTo === "/admin") return Boolean(matchRoute({ to: "/admin", fuzzy: false }));
    if (itemTo === "/admin/restaurantes" && matchRoute({ to: "/admin/restaurante/$id" }))
      return true;
    return Boolean(matchRoute({ to: itemTo as never }));
  }

  return (
    <>
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/25 to-violet-500/10 ring-1 ring-white/10">
          <UtensilsCrossed className="size-4 text-cyan-400" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight">
            Cardápio <span className="text-cyan-400">Cidadela</span>
          </p>
          <p className="truncate text-[10px] text-gray-600">Painel de gestão</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
          Menu
        </p>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.to);
          const isPedidos = item.to === "/admin/pedidos";
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-cyan-500/10 font-medium text-cyan-400"
                  : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-cyan-400 to-cyan-600" />
              )}
              <item.icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active ? "text-cyan-400" : "text-gray-500 group-hover:text-gray-300",
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {isPedidos && pendingCount > 0 && (
                <span className="flex min-w-6 items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-black text-white shadow-[0_0_10px_rgba(239,68,68,0.6)]">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] px-3 py-3">
        <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/20 text-xs font-bold text-cyan-200 ring-1 ring-white/10">
            {displayName
              ? displayName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() ?? "")
                  .join("")
              : "AD"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-gray-200">{displayName || "Conta"}</p>
            <p className="truncate text-[10px] text-gray-600">Administrador</p>
          </div>
        </div>
        <button
          onClick={async () => {
            await signOut();
            window.location.href = "/login";
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="size-3.5" />
          Sair da conta
        </button>
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-white/[0.04] hover:text-gray-300"
        >
          <ChevronRight className="size-3.5" />
          Ver site público
        </Link>
      </div>
    </>
  );
}
