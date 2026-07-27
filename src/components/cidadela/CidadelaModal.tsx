import { Bot, LayoutGrid, Lock, Settings, Receipt, X } from "lucide-react";
import { useState } from "react";

import { CobraFumando } from "@/components/CobraFumando";
import { CidadelaDashboard } from "@/components/cidadela/Dashboard";
import { PraxinhaChat } from "@/components/cidadela/Praxinha";
import { ConfigOperacional } from "@/components/cidadela/Config";
import { GerenciadorPedidos } from "@/components/cidadela/Pedidos";
import { useStore } from "@/modules/cidadela-core/store";
import { validateCidadelaCode } from "@/modules/fluxos-n8n/webhook";

type Tab = "core" | "praxinha" | "config" | "pedidos";

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
        const localValid = state.cidadela.codes.some((c) => c.code.toUpperCase() === value);
        if (localValid) {
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
          const errorMsg = response.erro === "codigo_expirado" 
            ? "Código expirado. Solicite um novo código."
            : response.erro === "tentativas_excedidas"
            ? "Muitas tentativas. Tente novamente em 5 minutos."
            : "Código negado. Acesso restrito ao comando.";
          setError(errorMsg);
        }
      }
    } catch {
      // Fallback para validação local em caso de erro
      const localValid = state.cidadela.codes.some((c) => c.code.toUpperCase() === value);
      if (localValid) {
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
          <button type="button" onClick={onClose} aria-label="Fechar Cidadela">
            <X className="size-5" />
          </button>
        </header>

        {!unlocked ? (
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
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={validating}
              className="text-tech mt-4 w-full rounded-lg bg-[color:var(--brass)] py-3 text-[11px] text-[color:var(--matte)] disabled:opacity-50"
            >
              {validating ? "Validando..." : "Autorizar entrada"}
            </button>
          </form>
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
              {tab === "praxinha" && <PraxinhaChat />}
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
      </div>
    </div>
  );
}
