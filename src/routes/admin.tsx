import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  UtensilsCrossed,
  LayoutDashboard,
  Store,
  Sandwich,
  ClipboardList,
  Share2,
  Settings,
  ChevronLeft,
  Menu,
  X,
  LogOut,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getRestaurantsByOwner, ensureRestaurantsForUser } from "@/modules/supabase/restaurants";
import { subscribeToOrders } from "@/modules/supabase/orders";
import { supabase } from "@/modules/supabase/client";
import { playNewOrderAlert, requestOrderNotificationPermission } from "@/lib/orderAlertSound";

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
                if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
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
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-[#0c0c14] lg:flex">
        <SidebarContent pendingCount={pendingCount} />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-white/5 bg-[#0c0c14]">
            <div className="flex items-center justify-between px-5 py-4">
              <Link to="/" className="flex items-center gap-2">
                <UtensilsCrossed className="size-5 text-cyan-400" />
                <span className="text-sm font-bold">
                  Cardápio <span className="text-cyan-400">Cidadela</span>
                </span>
              </Link>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400" aria-label="Fechar menu">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-3">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.to === "/admin"
                    ? matchRoute({ to: "/admin", fuzzy: false })
                    : matchRoute({ to: item.to });
                const isPedidos = item.to === "/admin/pedidos";
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                      active
                        ? "bg-cyan-500/10 text-cyan-400 font-medium"
                        : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                    }`}
                  >
                    <item.icon className="size-4" />
                    <span className="flex-1">{item.label}</span>
                    {isPedidos && pendingCount > 0 && (
                      <span className="flex min-w-6 items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-black text-white shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse">
                        {pendingCount > 99 ? "99+" : pendingCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-white/5 bg-[#0a0a0f] px-4 py-3 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>

          <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors">
            <ChevronLeft className="size-4" />
            <span className="text-xs">Voltar ao site</span>
          </Link>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ pendingCount = 0 }: { pendingCount?: number }) {
  const matchRoute = useMatchRoute();
  const { signOut } = useAuth();

  return (
    <>
      <div className="flex items-center gap-2 px-5 py-5">
        <UtensilsCrossed className="size-5 text-cyan-400" />
        <span className="text-sm font-bold">
          Cardápio <span className="text-cyan-400">Cidadela</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active =
            item.to === "/admin"
              ? matchRoute({ to: "/admin", fuzzy: false })
              : matchRoute({ to: item.to });
          const isPedidos = item.to === "/admin/pedidos";
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                active
                  ? "bg-cyan-500/10 text-cyan-400 font-medium"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              <item.icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {isPedidos && pendingCount > 0 && (
                <span className="flex min-w-6 items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-black text-white shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 px-5 py-4 space-y-2">
        <button
          onClick={async () => {
            await signOut();
            window.location.href = "/login";
          }}
          className="flex w-full items-center gap-2 text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          <LogOut className="size-3" />
          Sair da conta
        </button>
        <Link
          to="/"
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ChevronLeft className="size-3" />
          Voltar ao site
        </Link>
      </div>
    </>
  );
}
