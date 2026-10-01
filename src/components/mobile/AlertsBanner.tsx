import { useEffect, useState } from "react";
import { Bell, BellOff, ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { subscribePush } from "@/modules/mobile/push";
import {
  notificationPermission,
  requestNotificationPermission,
  type NotificationPermissionState,
} from "@/modules/mobile/preferences";
import { usePwaInstall } from "@/modules/pwa/usePwaInstall";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "cidadela:alerts-banner-dismissed";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

function readDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * Preparo dos alertas em uma linha só.
 *
 * Junta o que antes eram dois banners empilhados (ativar push + instalar app) e
 * só aparece quando ainda há algo a fazer: um toque resolve, e o resto dos
 * passos fica sob "detalhes". Quando as notificações já estão permitidas e o
 * app já está instalado, o bloco simplesmente não existe.
 */
export function AlertsBanner({ className }: { className?: string }) {
  const { canPrompt, isStandalone, install } = usePwaInstall();
  const [permission, setPermission] = useState<NotificationPermissionState>("granted");
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (readDismissed()) return;
    const current = notificationPermission();
    setPermission(current);
    // Já recebe alertas e já está instalado: nada a oferecer.
    if (current === "granted" && isStandalone) return;
    setVisible(true);
  }, [isStandalone]);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage bloqueado — o banner volta na próxima sessão */
    }
    setVisible(false);
  }

  async function activateAlerts() {
    setWorking(true);
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result !== "granted") {
      setWorking(false);
      if (result === "denied") toast.error("Notificações bloqueadas no navegador.");
      return;
    }
    const endpoint = await subscribePush();
    setWorking(false);
    if (endpoint) {
      toast.success("Alertas ativados! O celular toca mesmo com o app fechado.");
      if (isStandalone) setVisible(false);
      return;
    }
    toast.error("Não foi possível ativar os alertas neste dispositivo.");
  }

  async function installApp() {
    setWorking(true);
    const outcome = await install();
    setWorking(false);
    if (outcome !== "accepted") {
      setShowDetails(true);
      toast.info("Use o menu do navegador para adicionar à tela inicial.");
    }
  }

  if (!visible) return null;

  const alertsReady = permission === "granted";
  const denied = permission === "denied";

  return (
    <div className={cn("rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05]", className)}>
      <div className="flex items-center gap-3 p-3.5">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            denied ? "bg-white/[0.06] text-gray-400" : "bg-cyan-500/15 text-cyan-300",
          )}
        >
          {denied ? <BellOff className="size-5" /> : <Bell className="size-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">
            {denied
              ? "Notificações bloqueadas"
              : alertsReady
                ? "Instalar o app"
                : "Receber alertas"}
          </p>
          <p className="truncate text-[11px] text-gray-400">
            {denied
              ? "Libere no cadeado do navegador para o celular tocar."
              : alertsReady
                ? "Tela cheia e alerta sonoro direto da tela inicial."
                : "Um toque e o celular toca em cada pedido novo."}
          </p>
        </div>

        {!denied && (
          <button
            type="button"
            onClick={alertsReady ? installApp : activateAlerts}
            disabled={working}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-2 text-xs font-bold text-black transition-colors hover:bg-cyan-400 disabled:opacity-60"
          >
            {working ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : alertsReady ? (
              <Download className="size-3.5" />
            ) : (
              <Bell className="size-3.5" />
            )}
            {alertsReady ? (canPrompt ? "Instalar" : "Como instalar") : "Ativar"}
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar aviso de alertas"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
        >
          ✕
        </button>
      </div>

      {denied && (
        <p className="border-t border-white/[0.06] px-4 py-2.5 text-[11px] leading-relaxed text-amber-200/80">
          Abra o cadeado ao lado do endereço, libere as notificações deste site e toque em ativar de
          novo.
        </p>
      )}

      {!denied && (
        <button
          type="button"
          onClick={() => setShowDetails((open) => !open)}
          aria-expanded={showDetails}
          className="flex w-full items-center gap-1 border-t border-white/[0.06] px-4 py-2 text-[11px] font-medium text-cyan-300/80 transition-colors hover:text-cyan-200"
        >
          Como funcionam os alertas
          <ChevronDown className={cn("size-3 transition-transform", showDetails && "rotate-180")} />
        </button>
      )}

      {showDetails && !denied && (
        <ul className="space-y-1.5 border-t border-white/[0.06] px-4 py-3 text-[11px] leading-relaxed text-gray-400">
          <li>• O celular toca em cada pedido novo, mesmo com o app fechado.</li>
          <li>• O aviso mostra o cliente e o valor do pedido.</li>
          <li>• Instalado na tela inicial, abre em tela cheia sem barra do navegador.</li>
        </ul>
      )}
    </div>
  );
}
