import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  UtensilsCrossed,
  Bell,
  BellOff,
  Home,
  Users,
  TrendingUp,
  Settings,
  LogOut,
  Loader2,
  X,
  ChevronDown,
  Download,
  CheckCircle2,
  Clock,
  Package,
  DollarSign,
  Menu,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getRestaurantsByOwner, ensureRestaurantsForUser } from "@/modules/supabase/restaurants";
import { subscribeToOrders } from "@/modules/supabase/orders";
import { supabase } from "@/modules/supabase/client";
import { playNewOrderAlert, requestOrderNotificationPermission } from "@/lib/orderAlertSound";
import { cn } from "@/lib/utils";
import { signOut as supabaseSignOut } from "@/modules/supabase/auth";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export const Route = createFileRoute("/mobile")({
  head: () => ({
    meta: [{ title: "Gestão Mobile — Cardápio Cidadela" }],
  }),
  component: MobileLayout,
});

const MOBILE_NAV_ITEMS = [
  { to: "/mobile", label: "Pedidos", icon: Package },
  { to: "/mobile/clientes", label: "Clientes", icon: Users },
  { to: "/mobile/dashboard", label: "Dashboard", icon: TrendingUp },
  { to: "/mobile/config", label: "Config", icon: Settings },
] as const;

const COLORS = ["#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

function MobileLayout() {
  const [activeTab, setActiveTab] = useState("pedidos");
  const [pendingCount, setPendingCount] = useState(0);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [installing, setInstalling] = useState(false);
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

  // PWA Install Prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setShowInstallPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Badge + som: conta pedidos ativos
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
          console.error("[mobile badge] fetch", error);
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

  async function handleInstall() {
    setInstalling(true);
    const promptEvent = (window as any).deferredPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") {
        setShowInstallPrompt(false);
      }
      (window as any).deferredPrompt = null;
    }
    setInstalling(false);
  }

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
      {/* Sidebar */}
      <aside className={`w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0c0c14] transition-all duration-300 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full absolute z-50 h-full"
      } lg:translate-x-0 lg:relative lg:z-0`}>
        <div className="flex items-center gap-2 px-4 py-4 border-b border-white/5">
          <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/10">
            <UtensilsCrossed className="size-4 text-cyan-400" />
          </span>
          <span className="text-sm font-bold">
            Cardápio <span className="text-cyan-400">Cidadela</span>
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden ml-auto grid size-8 place-items-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {MOBILE_NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.to.split("/").pop();
            return (
              <button
                key={item.to}
                onClick={() => {
                  setActiveTab(item.to.split("/").pop() || "pedidos");
                  navigate({ to: item.to });
                  setSidebarOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm transition-all",
                  isActive ? "bg-cyan-500/10 text-cyan-400" : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200",
                )}
              >
                <item.icon className="size-4" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/5 px-3 py-4">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 transition-all"
          >
            <LogOut className="size-4" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/[0.06] bg-[#0c0c14] px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden grid size-8 place-items-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"
          >
            <Menu className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1.5">
                <Bell className="size-3.5 text-red-400" />
                <span className="text-xs font-bold text-red-400">{pendingCount}</span>
              </div>
            )}
          </div>
        </header>

        {/* Install Prompt Banner */}
        {showInstallPrompt && (
          <div className="border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.08] to-violet-500/[0.05] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-cyan-500/20">
                <Download className="size-4 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-cyan-300">Instalar aplicativo</p>
                <p className="text-[10px] text-gray-400">Adicione à tela inicial para acesso rápido</p>
              </div>
              <button
                onClick={handleInstall}
                disabled={installing}
                className="shrink-0 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-black transition-all hover:bg-cyan-400 disabled:opacity-50"
              >
                {installing ? <Loader2 className="size-3 animate-spin" /> : "Instalar"}
              </button>
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="shrink-0 grid size-6 place-items-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MobileLayout;