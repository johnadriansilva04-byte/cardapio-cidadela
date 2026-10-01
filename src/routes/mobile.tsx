import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import { Home, Users, TrendingUp, Settings, LogOut, Package, Menu } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useOwnerPendingOrders } from "@/modules/mobile/useOwnerOrders";
import { MobileStoreProvider, useMobileStore } from "@/modules/mobile/store-context";
import { playNewOrderAlert, requestOrderNotificationPermission } from "@/lib/orderAlertSound";
import { notifyNewOrder } from "@/modules/mobile/preferences";
import { AlertsBanner } from "@/components/mobile/AlertsBanner";
import { StoreStatusBadge } from "@/modules/ui/PageHeader";
import { signOut as supabaseSignOut } from "@/modules/supabase/auth";
import { AppLayout, AppSidebar, BrandHeader, BottomNav, Badge } from "@/components/shared";

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
  const { isAuthenticated, loading, user } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = "/login?returnTo=%2Fmobile";
    }
  }, [loading, isAuthenticated]);

  useEffect(() => {
    requestOrderNotificationPermission();
  }, []);

  if (!isAuthenticated) return null;

  return (
    <MobileStoreProvider userId={user?.id}>
      <MobileShell loading={loading} userId={user?.id} />
    </MobileStoreProvider>
  );
}

function MobileShell({ loading, userId }: { loading: boolean; userId: string | undefined }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const { primary, openNow } = useMobileStore();

  const pendingCount = useOwnerPendingOrders(userId, (order) => {
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

  const onConfig = Boolean(matchRoute({ to: "/mobile/config" }));

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
            {item.to === "/mobile" && pendingCount > 0 && <Badge count={pendingCount} />}
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

  // Cabeçalho único do app: menu, loja atual e pedidos em andamento. Cada aba
  // traz o próprio título logo abaixo — antes cada tela repetia o cabeçalho
  // inteiro com espaçamentos diferentes.
  const header = (
    <header className="flex items-center gap-3 border-b border-white/[0.06] bg-[#0a0a0f]/85 px-4 py-3 backdrop-blur">
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        aria-label="Abrir menu"
        className="grid size-9 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">
          {primary?.name ?? "Cardápio Cidadela"}
        </p>
        {primary && <StoreStatusBadge open={openNow} className="mt-0.5 px-2 py-0 text-[10px]" />}
      </div>

      {pendingCount > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300">
          <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
          {pendingCount} em andamento
        </span>
      )}
    </header>
  );

  return (
    <AppLayout loading={loading} sidebar={sidebar} header={header} className="pb-20 lg:pb-0">
      {/* Preparo dos alertas só onde ainda falta um passo; some sozinho quando
          já está tudo ativo e não reaparece em Configurações, que tem a versão
          completa do convite. */}
      {!onConfig && <AlertsBanner className="mx-4 mt-3" />}
      <Outlet />
      <BottomNav items={bottomNavItems} activeId="/mobile" />
    </AppLayout>
  );
}

export default MobileLayout;
