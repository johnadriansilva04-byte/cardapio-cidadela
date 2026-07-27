import { Bot, HelpCircle, LayoutGrid, Lock, Settings, Receipt, X, Map } from "lucide-react";
import { useState } from "react";

import { CobraFumando } from "@/components/CobraFumando";
import { CidadelaDashboard } from "@/components/cidadela/Dashboard";
import { PracinhaIA } from "@/components/cidadela/Praxinha";
import { ConfigOperacional } from "@/components/cidadela/Config";
import { GerenciadorPedidos } from "@/components/cidadela/Pedidos";
import { TemporalLobby } from "@/components/cidadela/TemporalLobby";
import { useStore } from "@/modules/cidadela-core/store";
import { isCodeValid } from "@/modules/cidadela-core/utils";
import { validateCidadelaCode } from "@/modules/fluxos-n8n/webhook";

type Tab = "core" | "praxinha" | "config" | "pedidos";
type ViewMode = "tabs" | "lobby";

const TABS: { id: Tab; label: string; icon: typeof Bot }[] = [
  { id: "core", label: "Core", icon: LayoutGrid },
  { id: "praxinha", label: "Praxinha AI", icon: Bot },
  { id: "pedidos", label: "Comandas", icon: Receipt },
  { id: "config", label: "Operacional", icon: Settings },
];

export function CidadelaModal({ onClose }: { onClose: () => void }) {
  const { state, update } = useStore();
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("core");
  const [validating, setValidating] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("tabs");

  async function tryUnlock(e: React.FormEvent) {
    e.preventDefault();
    const value = code.trim().toUpperCase();

    // Validação local primeiro (chave admin)
    if (value === state.admin.accessKey.toUpperCase()) {
      update((prev) => ({
        ...prev,
        cidadela: {
          ...prev.cidadela,
          accessHistory: [new Date().toISOString(), ...prev.cidadela.accessHistory].slice(0, 20),
        },
      }));
      setUnlocked(true);
      setCode("");
      setError("");
      return;
    }

    // Validação via webhook Cidadela
    setValidating(true);
    setError("");

    try {
      const response = await validateCidadelaCode(state.integrations.cidadelaAuthUrl, value);

      if (response.success && response.autenticado) {
        update((prev) => ({
          ...prev,
          cidadela: {
            ...prev.cidadela,
            accessHistory: [new Date().toISOString(), ...prev.cidadela.accessHistory].slice(0, 20),
          },
        }));
        setUnlocked(true);
        setCode("");
      } else {
        // Fallback para validação local de códigos promocionais
        const codeEntry = state.cidadela.codes.find((c) => c.code.toUpperCase() === value);
        if (codeEntry && isCodeValid(codeEntry)) {
          update((prev) => ({
            ...prev,
            cidadela: {
              ...prev.cidadela,
              codes: prev.cidadela.codes.map((c) =>
                c.code.toUpperCase() === value ? { ...c, used: true } : c,
              ),
              accessHistory: [new Date().toISOString(), ...prev.cidadela.accessHistory].slice(
                0,
                20,
              ),
            },
          }));
          setUnlocked(true);
          setCode("");
        } else if (codeEntry && !isCodeValid(codeEntry)) {
          setError("Código expirado. Faça uma nova compra para gerar um código.");
        } else {
          const errorMsg =
            response.erro === "codigo_expirado"
              ? "Código expirado. Solicite um novo código."
              : response.erro === "tentativas_excedidas"
                ? "Muitas tentativas. Tente novamente em 5 minutos."
                : "Código negado. Acesso restrito ao comando.";
          setError(errorMsg);
        }
      }
    } catch {
      // Fallback para validação local em caso de erro
      const codeEntry = state.cidadela.codes.find((c) => c.code.toUpperCase() === value);
      if (codeEntry && isCodeValid(codeEntry)) {
        update((prev) => ({
          ...prev,
          cidadela: {
            ...prev.cidadela,
            codes: prev.cidadela.codes.map((c) =>
              c.code.toUpperCase() === value ? { ...c, used: true } : c,
            ),
            accessHistory: [new Date().toISOString(), ...prev.cidadela.accessHistory].slice(0, 20),
          },
        }));
        setUnlocked(true);
        setCode("");
      } else if (codeEntry && !isCodeValid(codeEntry)) {
        setError("Código expirado. Faça uma nova compra para gerar um código.");
      } else {
        setError("Código negado. Acesso restrito ao comando.");
      }
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm">
      <div className="feb-scope mx-auto min-h-screen w-full max-w-4xl sm:my-6 sm:min-h-0 sm:rounded-2xl sm:border sm:border-border">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <CobraFumando className="size-9 text-[color:var(--brass)]" />
            <div>
              <h2 className="text-stencil text-xl">CIDADELA</h2>
              <p className="text-tech text-[9px] text-muted-foreground">
                Comando soberano · homenagem à FEB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "tabs" ? "lobby" : "tabs")}
              className="p-2 text-muted-foreground hover:text-cyan-400 transition-colors"
              title={viewMode === "tabs" ? "Ver Lobby Temporal" : "Ver Abas"}
            >
              <Map className="size-5" />
            </button>
            <button type="button" onClick={onClose} aria-label="Fechar Cidadela">
              <X className="size-5" />
            </button>
          </div>
        </header>

        {!unlocked ? (
          <>
            <form onSubmit={tryUnlock} className="mx-auto max-w-sm px-5 py-16 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-full border border-border">
                <Lock className="size-5 text-yellow-500" />
              </div>
              <h3 className="text-stencil mt-5 text-lg">Identifique-se, pracinha</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Informe a chave administrativa ou um código promocional válido.
              </p>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
                placeholder="FEB-XXXX-1944"
                className="text-tech mt-5 w-full rounded-lg border border-input bg-transparent px-3 py-3 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="mt-2 flex items-center justify-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Está sem o código? <HelpCircle className="size-3" />
              </button>
              {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={validating}
                className="text-tech mt-4 w-full rounded-lg bg-[color:var(--brass)] py-3 text-[11px] text-[color:var(--matte)] disabled:opacity-50"
              >
                {validating ? "Validando..." : "Autorizar entrada"}
              </button>
            </form>

            {showHelpModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
                <div className="w-full max-w-md rounded-xl border border-cyan-500/30 bg-slate-900/95 p-6 text-center">
                  <div className="mx-auto grid size-12 place-items-center rounded-full border border-cyan-500/50 bg-cyan-500/10">
                    <HelpCircle className="size-6 text-cyan-400" />
                  </div>
                  <h3 className="text-stencil mt-4 text-lg text-white">
                    🔓 COMO CONSEGUIR O CÓDIGO
                  </h3>
                  <div className="mt-4 space-y-4 text-left text-sm text-gray-300">
                    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                      <p className="font-semibold text-cyan-300">Qualquer compra:</p>
                      <p className="mt-1 text-xs">Garante 15 minutos de acesso à Cidadela.</p>
                    </div>
                    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                      <p className="font-semibold text-yellow-300">Compras acima de R$ 200,00:</p>
                      <p className="mt-1 text-xs">Garantem 15 dias de acesso total.</p>
                    </div>
                    <p className="text-xs text-gray-400 italic">
                      O seu código exclusivo será enviado automaticamente para o seu WhatsApp assim
                      que você finalizar o pedido!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(false)}
                    className="text-tech mt-6 w-full rounded-lg bg-cyan-500/20 border border-cyan-500/50 py-3 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                  >
                    Entendi
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {viewMode === "lobby" ? (
              <div className="h-[calc(100vh-73px)]">
                <TemporalLobby
                  onNavigate={(module) => {
                    if (module === "battle-arena") {
                      setViewMode("tabs");
                      setTab("core");
                    } else if (module === "iq-test" || module === "chat-ai") {
                      setViewMode("tabs");
                      setTab("praxinha");
                    } else if (module === "robot-lab") {
                      setViewMode("tabs");
                      setTab("praxinha");
                    }
                  }}
                />
              </div>
            ) : (
              <>
                <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
                  {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={`text-tech flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[10px] ${
                        tab === id
                          ? "bg-[color:var(--olive)] text-[color:var(--sand)]"
                          : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <Icon className="size-3.5" /> {label}
                    </button>
                  ))}
                </nav>

                <div className="px-5 py-6">
                  {tab === "core" && <CidadelaDashboard />}
                  {tab === "praxinha" && <PracinhaIA />}
                  {tab === "pedidos" && <GerenciadorPedidos />}
                  {tab === "config" && <ConfigOperacional />}
                </div>

                <footer className="border-t border-border px-5 py-4 text-center">
                  <p className="text-tech text-[9px] text-muted-foreground/70">
                    Brio, honra e dignidade — a cobra fumou em Monte Castelo, 1944/1945
                  </p>
                </footer>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
