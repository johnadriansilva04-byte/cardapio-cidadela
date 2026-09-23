import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import { Home, Users, TrendingUp, Settings, LogOut, Package } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useOwnerPendingOrders } from "@/modules/mobile/useOwnerOrders";
import { playNewOrderAlert, requestOrderNotificationPermission } from "@/lib/orderAlertSound";
import { notifyNewOrder } from "@/modules/mobile/preferences";
import { InstallCard } from "@/components/pwa/InstallCard";
import { PushBanner } from "@/components/pwa/PushBanner";
import { cn } from "@/lib/utils";
import { signOut as supabaseSignOut } from "@/modules/supabase/auth";
import {
  AppLayout,
  AppSidebar,
  AppHeader,
  BrandHeader,
  BottomNav,
  Badge,
} from "@/components/shared";

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

  if (!isAuthenticated) return null;

  const bottomNavItems = NAV_ITEMS.map((item) => ({
    id: item.to,
    label: item.label,
    icon: item.icon,
    to: item.to,
    badge: item.to === "/mobile" ? pendingCount : undefined,
  }));

  const sidebar = (
    <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}>
      <BrandHeader showClose={sidebarOpen} onClose={() => setSidebarOpen(false)} compact />
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
              <Badge count={pendingCount} />
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
    </AppSidebar>
  );

  const header = (
    <AppHeader
      showMenu
      onMenuClick={() => setSidebarOpen(true)}
      rightContent={
        pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300">
            <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
            {pendingCount} em andamento
          </span>
        )
      }
    />
  );

  return (
    <AppLayout loading={loading} sidebar={sidebar} header={header} className="pb-20 lg:pb-0">
      <PushBanner />
      <InstallCard variant="banner" />
      <Outlet />
      <BottomNav items={bottomNavItems} activeId="/mobile" />
    </AppLayout>
  );
}

export default MobileLayout;
