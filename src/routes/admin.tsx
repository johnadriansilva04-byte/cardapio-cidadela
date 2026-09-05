import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
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
import { playNewOrderAlert } from "@/lib/orderAlertSound";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Painel — MenuFácil" }],
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
  const matchRoute = useMatchRoute();
  const { isAuthenticated, loading, signOut, user } = useAuth();
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = "/login?returnTo=%2Fadmin";
    }
  }, [loading, isAuthenticated]);

  // Alerta sonoro global: toca quando qualquer restaurante do dono recebe pedido novo
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const channels: RealtimeChannel[] = [];
    let cancelled = false;

    (async () => {
      await ensureRestaurantsForUser(user);
      const rests = await getRestaurantsByOwner(user.id);
      if (cancelled) return;
      for (const r of rests) {
        const ch = subscribeToOrders(r.id, (eventType) => {
          if (eventType === "INSERT") playNewOrderAlert();
        });
        if (ch) channels.push(ch);
      }
    })();

    return () => {
      cancelled = true;
      for (const ch of channels) supabase.removeChannel(ch);
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
      {/* Sidebar — desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-[#0c0c14] lg:flex">
        <SidebarContent />
      </aside>

      {/* Sidebar — mobile overlay */}
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
                  Menu<span className="text-cyan-400">Fácil</span>
                </span>
              </Link>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-3">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.to === "/admin"
                    ? matchRoute({ to: "/admin", fuzzy: false })
                    : matchRoute({ to: item.to });

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
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
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

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarContent() {
  const matchRoute = useMatchRoute();
  const { signOut } = useAuth();

  return (
    <>
      <div className="flex items-center gap-2 px-5 py-5">
        <UtensilsCrossed className="size-5 text-cyan-400" />
        <span className="text-sm font-bold">
          Menu<span className="text-cyan-400">Fácil</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active =
            item.to === "/admin"
              ? matchRoute({ to: "/admin", fuzzy: false })
              : matchRoute({ to: item.to });

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
              {item.label}
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
