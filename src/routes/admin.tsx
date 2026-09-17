import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  UtensilsCrossed,
  LayoutDashboard,
  Store,
  Wallet,
  Share2,
  Settings,
  ChevronLeft,
  Menu,
  X,
  LogOut,
  Loader2,
  ChevronDown,
  UserRound,
  Trash2,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getRestaurantsByOwner, ensureRestaurantsForUser } from "@/modules/supabase/restaurants";
import { subscribeToOrders } from "@/modules/supabase/orders";
import { supabase } from "@/modules/supabase/client";
import { playNewOrderAlert, requestOrderNotificationPermission } from "@/lib/orderAlertSound";
import { cn } from "@/lib/utils";
import { deleteAccount } from "@/modules/supabase/auth";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
                    const n = new Notification("🔔 Novo pedido!", {
                      body: `${order.customer_name} — ${order.comanda} • R$ ${Number(order.total).toFixed(2)}`,
                      tag: `cidadela-order-${order.id}`,
                    });
                    // Clique leva direto ao painel global de pedidos, com a loja já filtrada.
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
  const { user } = useAuth();

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
          const showBadge = item.to === "/admin/pedidos" && pendingCount > 0;
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
              {showBadge && (
                <span
                  className="flex min-w-6 items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-black text-white shadow-[0_0_10px_rgba(239,68,68,0.6)]"
                  title={`${pendingCount} pedido${pendingCount === 1 ? "" : "s"} pendente${pendingCount === 1 ? "" : "s"}`}
                >
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] px-3 py-3">
        <AccountMenu displayName={displayName} onNavigate={onNavigate} />
      </div>
    </>
  );
}

function AccountMenu({
  displayName,
  onNavigate,
}: {
  displayName: string;
  onNavigate?: () => void;
}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initials = displayName
    ? displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("")
    : "AD";

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login", replace: true });
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteAccount();
    setDeleting(false);
    if (!res.ok) {
      setConfirmDeleteOpen(false);
      return;
    }
    // deleteAccount já desloga; garante a ida ao login
    navigate({ to: "/login", replace: true });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] data-[state=open]:bg-white/[0.06] outline-none">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/20 text-xs font-bold text-cyan-200 ring-1 ring-white/10">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-gray-200">
              {displayName || "Conta"}
            </span>
            <span className="block truncate text-[10px] text-gray-600">Administrador</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-gray-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="top"
          sideOffset={6}
          className="min-w-[200px] border-white/10 bg-[#14141d] text-gray-200 shadow-2xl"
        >
          <DropdownMenuLabel className="text-xs font-semibold text-gray-500">
            Minha conta
          </DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => {
              onNavigate?.();
              navigate({ to: "/admin/config", hash: "conta" });
            }}
            className="cursor-pointer gap-2.5 py-2 text-sm focus:bg-white/[0.06] focus:text-white"
          >
            <UserRound className="size-4 text-cyan-400" /> Editar conta
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              onNavigate?.();
              window.open("/", "_blank");
            }}
            className="cursor-pointer gap-2.5 py-2 text-sm focus:bg-white/[0.06] focus:text-white"
          >
            <ExternalLink className="size-4 text-gray-400" /> Ver site público
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/[0.08]" />
          <DropdownMenuItem
            onSelect={handleSignOut}
            className="cursor-pointer gap-2.5 py-2 text-sm focus:bg-white/[0.06] focus:text-white"
          >
            <LogOut className="size-4 text-gray-400" /> Sair da conta
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              onNavigate?.();
              setConfirmDeleteOpen(true);
            }}
            className="cursor-pointer gap-2.5 py-2 text-sm text-red-400 focus:bg-red-500/10 focus:text-red-300"
          >
            <Trash2 className="size-4" /> Excluir conta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Excluir conta?"
        description="Todos os seus restaurantes, cardápios e pedidos serão apagados permanentemente. Não há como desfazer."
        confirmLabel="Sim, excluir"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
