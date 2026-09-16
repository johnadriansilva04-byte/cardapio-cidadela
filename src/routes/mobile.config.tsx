import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  BellRing,
  Clock,
  ExternalLink,
  Info,
  Loader2,
  LogOut,
  MonitorSmartphone,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Volume2,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { InstallCard } from "@/components/pwa/InstallCard";
import { ExpandableSection, InfoRow } from "@/modules/ui/ExpandableSection";
import {
  loadPreferences,
  notificationPermission,
  requestNotificationPermission,
  savePreference,
  subscribePreferences,
  type MobilePreferences,
  type NotificationPermissionState,
} from "@/modules/mobile/preferences";
import { useOwnerOrders } from "@/modules/mobile/useOwnerOrders";
import { previewOrderAlert } from "@/lib/orderAlertSound";
import { useWakeLock } from "@/modules/mobile/useWakeLock";
import { isOpenNow } from "@/lib/operatingHours";
import { usePwaInstall } from "@/modules/pwa/usePwaInstall";
import { signOut } from "@/modules/supabase/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/mobile/config")({
  head: () => ({
    meta: [
      { title: "Configurações — Gestão Mobile" },
      {
        name: "description",
        content:
          "Instale o app, ajuste os alertas de novos pedidos e confira o status da sua loja no celular.",
      },
    ],
  }),
  component: MobileConfigPage,
});

const APP_VERSION = "1.1";

function MobileConfigPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { restaurants, orders, loading, refresh } = useOwnerOrders(user?.id);

  const [prefs, setPrefs] = useState<MobilePreferences>(() => loadPreferences());
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [requesting, setRequesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { isStandalone } = usePwaInstall();
  const wakeLock = useWakeLock(prefs.keepAwake && !loading);

  useEffect(() => subscribePreferences(setPrefs), []);
  useEffect(() => setPermission(notificationPermission()), []);

  const displayName =
    (user?.user_metadata?.name as string | undefined) || profile?.name || user?.email || "Operador";

  function update<K extends keyof MobilePreferences>(key: K, value: MobilePreferences[K]) {
    savePreference(key, value);
    setPrefs((current) => ({ ...current, [key]: value }));
  }

  async function handleEnableNotifications() {
    setRequesting(true);
    const result = await requestNotificationPermission();
    setPermission(result);
    setRequesting(false);
    if (result === "granted") {
      update("notifications", true);
      toast.success("Notificações ativadas.");
    } else if (result === "denied") {
      toast.error("O navegador bloqueou as notificações deste site.");
    } else if (result === "unsupported") {
      toast.error("Este navegador não suporta notificações.");
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login", replace: true });
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <RefreshCw className="size-7 animate-spin text-cyan-400" />
        <p className="mt-3 text-sm text-gray-400">Carregando configurações…</p>
      </div>
    );
  }

  const storeStatus =
    restaurants.length === 0
      ? "Nenhuma loja"
      : restaurants.length === 1
        ? restaurants[0].name
        : `${restaurants.length} lojas`;

  const openNow = restaurants.length > 0 && isOpenNow(restaurants[0].operating_hours);
  const activeOrders = orders.filter((order) =>
    ["received", "preparing", "ready", "out_for_delivery"].includes(order.status),
  ).length;

  const notificationLabel =
    permission === "granted"
      ? "Permitidas"
      : permission === "denied"
        ? "Bloqueadas no navegador"
        : permission === "unsupported"
          ? "Sem suporte neste navegador"
          : "Ainda não pedidas";

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-white">Configurações</h1>
        <p className="text-xs text-gray-400">
          {displayName} · {storeStatus}
        </p>
      </div>

      {/* Instalação */}
      <InstallCard />

      {/* Alertas */}
      <ExpandableSection
        icon={<BellRing className="size-5" />}
        tone="cyan"
        title="Alertas de novos pedidos"
        summary={`Som ${prefs.sound ? "ligado" : "desligado"} · Notificações ${
          permission === "granted" ? "ligadas" : "desligadas"
        }`}
      >
        <div className="space-y-3">
          <ToggleRow
            icon={<Volume2 className="size-4" />}
            title="Alerta sonoro"
            description="Sirene alta, repetida duas vezes, com vibração a cada pedido novo."
            checked={prefs.sound}
            onChange={(value) => {
              update("sound", value);
              if (value) previewOrderAlert();
            }}
          />

          <ToggleRow
            icon={<Bell className="size-4" />}
            title="Notificação do sistema"
            description="Mostra o aviso na tela mesmo com o app em segundo plano."
            checked={prefs.notifications && permission === "granted"}
            onChange={(value) => {
              if (value && permission !== "granted") {
                void handleEnableNotifications();
                return;
              }
              update("notifications", value);
            }}
          />

          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <InfoRow label="Permissão do navegador" value={notificationLabel} />
            {permission !== "granted" && (
              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={requesting || permission === "unsupported"}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-200 transition-colors hover:bg-cyan-500/25 disabled:opacity-50"
              >
                {requesting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Bell className="size-3.5" />
                )}
                {permission === "denied" ? "Reexplicar como liberar" : "Permitir notificações"}
              </button>
            )}
            {permission === "denied" && (
              <p className="mt-2 text-[11px] leading-relaxed text-amber-200/80">
                O bloqueio fica nas configurações do próprio navegador: abra o cadeado ao lado do
                endereço e libere as notificações deste site.
              </p>
            )}
          </div>
        </div>
      </ExpandableSection>

      {/* Operação */}
      <ExpandableSection
        icon={<Clock className="size-5" />}
        tone="violet"
        title="Operação na tela"
        summary={`Tela ${prefs.keepAwake ? "sempre ligada" : "normal"} · Cards ${
          prefs.compactCards ? "recolhidos" : "abertos"
        }`}
      >
        <div className="space-y-3">
          <ToggleRow
            icon={prefs.keepAwake ? <Sun className="size-4" /> : <Moon className="size-4" />}
            title="Manter a tela ligada"
            description="Útil no balcão: a tela não apaga enquanto o painel estiver aberto."
            checked={prefs.keepAwake}
            onChange={(value) => {
              update("keepAwake", value);
              if (value && wakeLock === "unsupported") {
                toast.error("Este navegador não permite manter a tela ligada.");
              }
            }}
            hint={
              prefs.keepAwake && wakeLock === "blocked"
                ? "O navegador recusou agora — funciona com o app instalado."
                : undefined
            }
          />

          <ToggleRow
            icon={<MonitorSmartphone className="size-4" />}
            title="Cards recolhidos por padrão"
            description="A lista mostra o resumo; os itens do pedido abrem ao tocar."
            checked={prefs.compactCards}
            onChange={(value) => update("compactCards", value)}
          />

          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <InfoRow label="Status da loja" value={openNow ? "Aberto agora" : "Fechado agora"} />
            <InfoRow label="Pedidos em andamento" value={activeOrders} />
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            Recarregar dados
          </button>
        </div>
      </ExpandableSection>

      {/* Atalhos */}
      <ExpandableSection
        icon={<ExternalLink className="size-5" />}
        title="Atalhos"
        summary="Painel completo, cardápio público e privacidade"
      >
        <div className="space-y-2">
          <ShortcutLink
            to="/admin"
            label="Painel administrativo"
            description="Cardápio, financeiro e clientes"
          />
          {restaurants[0] && (
            <ShortcutLink
              to={`/cardapio/${restaurants[0].slug}`}
              label="Ver cardápio público"
              description="Exatamente como o cliente vê"
            />
          )}
          <ShortcutLink
            to="/privacy"
            label="Política de privacidade"
            description="Como tratamos os dados"
          />
        </div>
      </ExpandableSection>

      {/* Conta */}
      <ExpandableSection
        icon={<ShieldCheck className="size-5" />}
        title="Conta"
        summary={displayName}
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <InfoRow label="Nome" value={displayName} />
            <InfoRow
              label="Telefone"
              value={(user?.user_metadata?.phone as string | undefined) || profile?.phone || "—"}
            />
            <InfoRow label="E-mail" value={user?.email || "—"} />
          </div>
          <Link
            to="/admin/config"
            hash="conta"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold text-gray-300 transition-colors hover:bg-white/10"
          >
            Editar dados e senha
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/20"
          >
            <LogOut className="size-3.5" /> Sair da conta
          </button>
        </div>
      </ExpandableSection>

      {/* Sobre */}
      <ExpandableSection
        icon={<Info className="size-5" />}
        title="Sobre o aplicativo"
        summary={`Cardápio Cidadela v${APP_VERSION}`}
      >
        <div className="space-y-2 text-xs leading-relaxed text-gray-400">
          <p>
            Sistema de cardápio digital e gestão de pedidos para restaurantes: pedido em tempo real,
            PIX, comanda térmica e painel de faturamento.
          </p>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <InfoRow label="Versão" value={`v${APP_VERSION}`} />
            <InfoRow label="Modo" value={isStandalone ? "App instalado" : "Navegador"} />
          </div>
        </div>
      </ExpandableSection>
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
  hint,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-gray-300">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white">{title}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">{description}</p>
          {hint && <p className="mt-1 text-[11px] text-amber-200/80">{hint}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={title}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            checked ? "bg-cyan-500" : "bg-white/10",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white transition-transform",
              checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
    </div>
  );
}

function ShortcutLink({
  to,
  label,
  description,
}: {
  to: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      target={to.startsWith("/cardapio") ? "_blank" : undefined}
      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-white">{label}</p>
        <p className="truncate text-[11px] text-gray-500">{description}</p>
      </div>
      <ExternalLink className="size-3.5 shrink-0 text-gray-500" />
    </Link>
  );
}

export default MobileConfigPage;
