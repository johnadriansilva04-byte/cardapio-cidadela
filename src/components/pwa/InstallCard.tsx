import { useState } from "react";
import { CheckCircle2, Download, Loader2, MonitorSmartphone, Share, X } from "lucide-react";
import { usePwaInstall } from "@/modules/pwa/usePwaInstall";
import { cn } from "@/lib/utils";

export interface InstallCardProps {
  /** "banner" é a faixa fina; "card" é o bloco completo usado em Configurações. */
  variant?: "banner" | "card";
  className?: string;
}

/**
 * Instalação do app.
 *
 * O botão de instalação só aparece quando existe um prompt nativo — nos casos
 * em que o navegador não oferece (iOS, ou Android que já instalou), mostramos o
 * caminho manual em vez de um botão que não faz nada.
 */
export function InstallCard({ variant = "card", className }: InstallCardProps) {
  const { canPrompt, isStandalone, dismissed, install, dismiss, reset, instructions } =
    usePwaInstall();
  const [status, setStatus] = useState<"idle" | "working" | "done">("idle");
  const [showSteps, setShowSteps] = useState(false);

  if (isStandalone) {
    return variant === "card" ? (
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4",
          className,
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15">
          <CheckCircle2 className="size-5 text-emerald-300" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-emerald-200">App instalado</p>
          <p className="text-xs text-emerald-200/70">
            Você já está usando a versão instalada do Cardápio Cidadela.
          </p>
        </div>
      </div>
    ) : null;
  }

  if (variant === "banner" && dismissed) return null;

  async function handleInstall() {
    setStatus("working");
    const outcome = await install();
    if (outcome === "accepted") {
      setStatus("done");
      return;
    }
    setStatus("idle");
    // Sem prompt nativo: mostra o passo a passo do sistema.
    setShowSteps(true);
  }

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 border-b border-cyan-500/20 bg-cyan-500/[0.07] px-4 py-2.5",
          className,
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-cyan-500/15">
          <Download className="size-4 text-cyan-300" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-cyan-200">Instalar aplicativo</p>
          <p className="truncate text-[10px] text-gray-400">
            Receba pedidos com alerta sonoro direto da tela inicial
          </p>
        </div>
        <button
          type="button"
          onClick={handleInstall}
          disabled={status === "working"}
          className="shrink-0 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-cyan-400 disabled:opacity-50"
        >
          {status === "working" ? <Loader2 className="size-3 animate-spin" /> : "Instalar"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ocultar convite de instalação"
          className="grid size-6 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] to-violet-500/[0.04] p-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-500/15">
          <MonitorSmartphone className="size-5 text-cyan-300" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-cyan-200">
            {status === "done" ? "Instalação iniciada" : "Instalar aplicativo"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            {canPrompt
              ? "Adicione à tela inicial para abrir em tela cheia e receber pedidos com alerta."
              : "Seu navegador não oferece instalação automática — siga os passos abaixo."}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {canPrompt ? (
          <button
            type="button"
            onClick={handleInstall}
            disabled={status === "working"}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-cyan-400 disabled:opacity-50"
          >
            {status === "working" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {status === "working" ? "Instalando…" : "Instalar agora"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowSteps((open) => !open)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500/15 px-4 py-2.5 text-sm font-bold text-cyan-200 transition-colors hover:bg-cyan-500/25"
          >
            <Share className="size-4" />
            {showSteps ? "Ocultar passos" : "Como instalar"}
          </button>
        )}
      </div>

      {(showSteps || !canPrompt) && (
        <ol className="mt-3 space-y-2">
          {instructions.map((step, index) => (
            <li key={step} className="flex gap-2.5 text-xs leading-relaxed text-gray-300">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[10px] font-bold text-cyan-300">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}

      {dismissed && (
        <button
          type="button"
          onClick={reset}
          className="mt-3 text-[11px] font-medium text-cyan-300/80 underline-offset-2 hover:underline"
        >
          Quero ver o convite de novo
        </button>
      )}
    </div>
  );
}
