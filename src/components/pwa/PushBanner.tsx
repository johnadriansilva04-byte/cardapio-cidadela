import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { subscribePush } from "@/modules/mobile/push";
import { requestNotificationPermission } from "@/modules/mobile/preferences";

/**
 * Banner de ativação de push em um toque.
 *
 * Aparece no app mobile enquanto as notificações não estiverem permitidas.
 * Um toque pede permissão e registra o dispositivo em `push_subscriptions` —
 * é isso que faz o celular tocar mesmo com o app fechado.
 */

const DISMISS_KEY = "cidadela:push-banner-dismissed";
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

export function PushBanner() {
  const [visible, setVisible] = useState(false);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (readDismissed()) return;

    if (Notification.permission === "granted") return; // já ativo
    if (Notification.permission === "denied") {
      setDenied(true);
    }
    setVisible(true);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  async function activate() {
    setLoading(true);
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      setLoading(false);
      if (permission === "denied") {
        setDenied(true);
        toast.error("Notificações bloqueadas. Libere nas configurações do navegador.");
      }
      return;
    }
    const endpoint = await subscribePush();
    setLoading(false);
    if (endpoint) {
      setVisible(false);
      toast.success("Alertas ativados! Você será avisado mesmo com o app fechado.");
    } else {
      toast.error("Não foi possível ativar os alertas neste dispositivo.");
    }
  }

  if (!visible) return null;

  return (
    <div className="mx-4 mt-3" role="status">
      <div
        className={
          denied
            ? "flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            : "flex items-center gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.07] px-4 py-3"
        }
      >
        {denied ? (
          <BellOff className="size-5 shrink-0 text-gray-500" />
        ) : (
          <Bell className="size-5 shrink-0 text-cyan-400" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {denied ? "Notificações bloqueadas" : "Receber alerta de pedidos"}
          </p>
          <p className="truncate text-xs text-gray-400">
            {denied
              ? "Libere nas configurações do navegador para ser avisado."
              : "Toque para o celular tocar mesmo com o app fechado."}
          </p>
        </div>

        {!denied && (
          <button
            type="button"
            onClick={activate}
            disabled={loading}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-[#062023] transition-colors hover:bg-cyan-400 disabled:opacity-60"
          >
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            Ativar
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar aviso"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
