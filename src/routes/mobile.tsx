import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import {
  UtensilsCrossed,
  Home,
  Users,
  TrendingUp,
  Settings,
  LogOut,
  Loader2,
  X,
  Menu,
  Package,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useOwnerPendingOrders } from "@/modules/mobile/useOwnerOrders";
import { playNewOrderAlert, requestOrderNotificationPermission } from "@/lib/orderAlertSound";
import { notifyNewOrder } from "@/modules/mobile/preferences";
import { InstallCard } from "@/components/pwa/InstallCard";
import { PushBanner } from "@/components/pwa/PushBanner";
import { cn } from "@/lib/utils";
import { signOut as supabaseSignOut } from "@/modules/supabase/auth";

export const Route = createFileRoute("/mobile")({
  head: () => ({
    meta: [
      { title: "Gestão Mobile — Cardápio Cidadela" },
      {
        name: "description",
        content:
          "Acompanhe e avance os pedidos do seu restaurante pelo celular, com alerta sonoro em cada novo pedido.",
      },
    ],
  }),
  component: MobileLayout,
});

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/mobile", label: "Pedidos", icon: Package },
  { to: "/mobile/clientes", label: "Clientes", icon: Users },
  { to: "/mobile/dashboard", label: "Painel", icon: TrendingUp },
  { to: "/mobile/config", label: "Config", icon: Settings },
];

function MobileLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = "/login?returnTo=%2Fmobile";
    }
  }, [loading, isAuthenticated]);

  useEffect(() => {
    requestOrderNotificationPermission();
  }, []);

  const pendingCount = useOwnerPendingOrders(user?.id, (order) => {
    playNewOrderAlert();
    notifyNewOrder(
      " Novo pedido!",
      `${order.customer_name} — ${order.comanda} • R$ ${Number(order.total).toFixed(2)}`,
      () => navigate({ to: "/mobile" }),
    );
  });

  async function handleSignOut() {
    await supabaseSignOut();
    navigate({ to: "/login", replace: true });
  }

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
      {/* Sidebar — navegação em tablet e desktop */}
      <aside
        className={cn(
          "absolute z-50 flex h-full w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0c0c14] transition-transform duration-300 lg:relative lg:z-0 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-4">
          <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/10">
            <UtensilsCrossed className="size-4 text-cyan-400" />
          </span>
          <span className="text-sm font-bold">
            Cardápio <span className="text-cyan-400">Cidadela</span>
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
            className="ml-auto grid size-8 place-items-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/mobile" }}
              activeProps={{ className: "bg-cyan-500/10 font-medium text-cyan-300" }}
              inactiveProps={{
                className: "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200",
              }}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all"
            >
              <item.icon className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.to === "/mobile" && pendingCount > 0 && (
                <span className="flex min-w-6 items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-black text-white">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
          ))}

          <Link
            to="/admin"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-400 transition-all hover:bg-white/[0.04] hover:text-gray-200"
          >
            <Home className="size-4 shrink-0" />
            <span className="flex-1">Painel completo</span>
          </Link>
        </nav>

        <div className="border-t border-white/5 px-3 py-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-400 transition-all hover:bg-white/[0.04] hover:text-gray-200"
          >
            <LogOut className="size-4" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-white/[0.06] bg-[#0c0c14] px-4 py-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
            className="grid size-9 place-items-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <span className="flex items-center gap-2 lg:hidden">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/10">
              <UtensilsCrossed className="size-3.5 text-cyan-400" />
            </span>
            <span className="text-sm font-bold text-white">Cidadela</span>
          </span>

          <div className="ml-auto flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300">
                <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
                {pendingCount} em andamento
              </span>
            )}
          </div>
        </header>

        <PushBanner />

        <InstallCard variant="banner" />

        {/* pb-20 reserva espaço para a barra inferior no celular */}
        <main className="flex-1 overflow-auto pb-20 lg:pb-0">
          <Outlet />
        </main>

        <BottomNav pendingCount={pendingCount} />
      </div>
    </div>
  );
}

/** Barra inferior — o acesso principal quando o app roda no celular. */
function BottomNav({ pendingCount }: { pendingCount: number }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-[#0c0c14]/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/mobile" }}
            activeProps={{ className: "text-cyan-300" }}
            inactiveProps={{ className: "text-gray-500" }}
            className="relative flex flex-1 flex-col items-center gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 text-[10px] font-semibold transition-colors"
          >
            <span className="relative">
              <item.icon className="size-5" />
              {item.to === "/mobile" && pendingCount > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default MobileLayout;
