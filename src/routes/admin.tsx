import { createFileRoute, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Store,
  Wallet,
  Share2,
  Settings,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getRestaurantsByOwner, ensureRestaurantsForUser } from "@/modules/supabase/restaurants";
import { subscribeToOrders } from "@/modules/supabase/orders";
import { supabase } from "@/modules/supabase/client";
import { playNewOrderAlert, requestOrderNotificationPermission } from "@/lib/orderAlertSound";
import {
  AppLayout,
  AppSidebar,
  AppHeader,
  BrandHeader,
  AccountMenu,
  NavigationItem,
} from "@/components/shared";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Painel — Cardápio Cidadela" }],
  }),
  component: AdminLayout,
});

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/admin/restaurantes", label: "Restaurantes", icon: Store },
  { to: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/admin/compartilhar", label: "Compartilhar", icon: Share2 },
  { to: "/admin/config", label: "Configurações", icon: Settings },
] as const;

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const { isAuthenticated, loading, user } = useAuth();

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
                    const n = new Notification("🔔 Novo pedido!", {
                      body: `${order.customer_name} — ${order.comanda} • R$ ${Number(order.total).toFixed(2)}`,
                      tag: `cidadela-order-${order.id}`,
                    });
                    n.onclick = () => {
                      window.focus();
                      navigate({
                        to: "/admin/pedidos",
                        search: { store: order.restaurant_id },
                      });
                      n.close();
                    };
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
  }, [isAuthenticated, user, navigate]);

  if (!isAuthenticated) return null;

  function isActive(itemTo: string): boolean {
    if (itemTo === "/admin") return Boolean(matchRoute({ to: "/admin", fuzzy: false }));
    if (itemTo === "/admin/restaurantes" && matchRoute({ to: "/admin/restaurante/$id" }))
      return true;
    return Boolean(matchRoute({ to: itemTo as never }));
  }

  const { user: authUser } = useAuth();
  const displayName = (authUser?.user_metadata?.name as string) || authUser?.email || authUser?.phone || "";

  const sidebar = (
    <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}>
      <BrandHeader showClose={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
          Menu
        </p>
        {NAV_ITEMS.map((item) => (
          <NavigationItem
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
            isActive={isActive(item.to)}
            badge={item.to === "/admin/pedidos" ? pendingCount : undefined}
            onClick={() => setSidebarOpen(false)}
          />
        ))}
      </nav>
      <div className="border-t border-white/[0.06] px-3 py-3">
        <AccountMenu displayName={displayName} onNavigate={() => setSidebarOpen(false)} />
      </div>
    </AppSidebar>
  );

  const header = (
    <AppHeader showMenu onMenuClick={() => setSidebarOpen(true)} />
  );

  return (
    <AppLayout loading={loading} sidebar={sidebar} header={header}>
      <Outlet />
    </AppLayout>
  );
}
