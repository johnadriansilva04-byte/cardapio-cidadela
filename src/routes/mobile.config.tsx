import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Settings, Bell, Download, RefreshCw, Info, ExternalLink } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getRestaurantsByOwner } from "@/modules/supabase/restaurants";

export const Route = createFileRoute("/mobile/config")({
  head: () => ({
    meta: [{ title: "Configurações — Gestão Mobile" }],
  }),
  component: MobileConfig,
});

function MobileConfig() {
  const { user } = useAuth();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, [user]);

  async function loadConfig() {
    if (!user) return;
    try {
      setLoading(true);
      
      // Check notification permission
      setNotificationsEnabled(Notification.permission === "granted");
      
      // Check if install prompt is available
      const hasPrompt = "deferredPrompt" in window;
      setShowInstallPrompt(hasPrompt);
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  }

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

  async function requestNotificationPermission() {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="mx-auto size-8 animate-spin text-cyan-400" />
          <p className="mt-3 text-sm text-gray-400">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-white">Configurações</h1>
        <p className="text-xs text-gray-400">Personalize sua experiência</p>
      </div>

      {/* Install App Section */}
      {showInstallPrompt && (
        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] to-violet-500/[0.05] p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-500/20">
              <Download className="size-5 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-cyan-300">Instalar Aplicativo</h3>
              <p className="text-xs text-gray-400 mt-1">
                Adicione este app à tela inicial do seu celular para acesso rápido e experiência completa.
              </p>
            </div>
          </div>
          <button
            onClick={handleInstall}
            disabled={installing}
            className="mt-3 w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-black transition-all hover:bg-cyan-400 disabled:opacity-50"
          >
            {installing ? "Instalando..." : "Instalar Agora"}
          </button>
        </div>
      )}

      {/* Notifications Section */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5">
            <Bell className="size-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white">Notificações</h3>
            <p className="text-xs text-gray-400 mt-1">
              Receba alertas quando novos pedidos chegarem
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {notificationsEnabled ? "Ativadas" : "Desativadas"}
          </span>
          <button
            onClick={requestNotificationPermission}
            disabled={notificationsEnabled}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              notificationsEnabled
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            {notificationsEnabled ? "Ativado" : "Ativar"}
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5">
            <Info className="size-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white">Sobre</h3>
            <p className="text-xs text-gray-400 mt-1">
              Cardápio Cidadela v1.0
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Sistema de gestão mobile para restaurantes
            </p>
          </div>
        </div>
      </div>

      {/* Links Section */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5">
            <ExternalLink className="size-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white">Links Úteis</h3>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <a
            href="/admin"
            target="_blank"
            className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-xs text-gray-300 hover:bg-white/10 transition-colors"
          >
            <span>Painel Administrativo</span>
            <ExternalLink className="size-3.5" />
          </a>
          <a
            href="/"
            target="_blank"
            className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-xs text-gray-300 hover:bg-white/10 transition-colors"
          >
            <span>Site Público</span>
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default MobileConfig;