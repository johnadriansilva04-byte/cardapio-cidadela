import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { CobraFumando } from "@/components/CobraFumando";
import { PracinhaIA } from "@/components/cidadela/Praxinha";
import { IQTest } from "@/components/cidadela/IQTest";
import { FutebolBotao } from "@/components/cidadela/FutebolBotao";
import { RobotLab } from "@/components/cidadela/RobotLab";
import { BattleArena } from "@/components/cidadela/BattleArena";
import { TemporalLobby } from "@/components/cidadela/TemporalLobby";
import { TrilhaGame } from "@/components/cidadela/Trilha/TrilhaGame";
import { StoreProvider, useStore } from "@/modules/cidadela-core/store";
import { validateCidadelaCode } from "@/modules/fluxos-n8n/webhook";

export const Route = createFileRoute("/cidadela")({
  head: () => ({
    meta: [
      { title: "Cidadela — Mundo FEB" },
      {
        name: "description",
        content:
          "Entre na Cidadela: mundo de inteligência artificial, testes de QI, arena de batalha de robôs e muito mais.",
      },
    ],
  }),
  component: () => (
    <StoreProvider>
      <CidadelaWorld />
    </StoreProvider>
  ),
});

type Module = "praxinha" | "iq" | "arena" | "lab" | "futebol" | "trilha";

const MODULES: { id: Module; label: string; description: string }[] = [
  { id: "praxinha", label: "Pracinha IA", description: "Converse com a inteligência artificial" },
  { id: "iq", label: "Teste de QI", description: "Desafie sua mente" },
  { id: "arena", label: "Arena de Batalha", description: "Robôs debatendo ideologia" },
  { id: "lab", label: "Laboratório de Robô", description: "Crie sua estratégia" },
  { id: "futebol", label: "Futebol de Botão", description: "Jogue clássico" },
];

function CidadelaWorld() {
  const { state, update } = useStore();
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [validating, setValidating] = useState(false);

  async function tryUnlock(e: React.FormEvent) {
    e.preventDefault();
    const value = code.trim().toUpperCase();

    // Verificar se é código premium
    const isPremiumCode = value.startsWith("PREMIUM-") || value === "FEB-VIP";

    if (value === state.admin.accessKey.toUpperCase()) {
      update((prev) => ({
        ...prev,
        cidadela: {
          ...prev.cidadela,
          accessHistory: [new Date().toISOString(), ...prev.cidadela.accessHistory].slice(0, 20),
          isPremium: isPremiumCode || prev.cidadela.isPremium,
        },
      }));
      setUnlocked(true);
      setCode("");
      setError("");
      return;
    }

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
            isPremium: isPremiumCode || prev.cidadela.isPremium,
          },
        }));
        setUnlocked(true);
        setCode("");
      } else {
        const localValid = state.cidadela.codes.some((c) => c.code.toUpperCase() === value);
        if (localValid) {
          update((prev) => ({
            ...prev,
            cidadela: {
              ...prev.cidadela,
              accessHistory: [new Date().toISOString(), ...prev.cidadela.accessHistory].slice(
                0,
                20,
              ),
              isPremium: isPremiumCode || prev.cidadela.isPremium,
            },
          }));
          setUnlocked(true);
          setCode("");
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
      const localValid = state.cidadela.codes.some((c) => c.code.toUpperCase() === value);
      if (localValid) {
        update((prev) => ({
          ...prev,
          cidadela: {
            ...prev.cidadela,
            accessHistory: [new Date().toISOString(), ...prev.cidadela.accessHistory].slice(0, 20),
            isPremium: isPremiumCode || prev.cidadela.isPremium,
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

  if (activeModule) {
    return (
      <div className="min-h-screen bg-background">
        {activeModule === "trilha" ? (
          <TrilhaGame onBack={() => setActiveModule(null)} />
        ) : (
          <>
            <header className="flex items-center justify-between border-b border-border px-6 py-4">
              <Link to="/" className="flex items-center gap-3">
                <CobraFumando className="size-8 text-[color:var(--brass)]" />
                <span className="text-stencil text-lg">CIDADELA</span>
              </Link>
              <button
                type="button"
                onClick={() => setActiveModule(null)}
                className="text-tech rounded-md bg-secondary px-4 py-2 text-sm"
              >
                Voltar ao Mundo
              </button>
            </header>
            {activeModule === "praxinha" && <PracinhaIA />}
            {activeModule === "iq" && <IQTest />}
            {activeModule === "arena" && <BattleArena />}
            {activeModule === "lab" && <RobotLab />}
            {activeModule === "futebol" && <FutebolBotao />}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {!unlocked ? (
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="mx-auto grid size-20 place-items-center rounded-full border-2 border-border">
            <CobraFumando className="size-10 text-[color:var(--brass)]" />
          </div>
          <h1 className="text-stencil mt-6 text-3xl">CIDADELA</h1>
          <p className="mt-2 text-center text-muted-foreground">Mundo de honra, dignidade e brio</p>
          <form onSubmit={tryUnlock} className="mt-8 w-full max-w-sm">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              placeholder="Informe o código de acesso"
              className="text-tech w-full rounded-lg border border-input bg-transparent px-4 py-3 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={validating}
              className="text-tech mt-4 w-full rounded-lg bg-[color:var(--brass)] py-3 text-sm text-[color:var(--matte)] disabled:opacity-50"
            >
              {validating ? "Validando..." : "Entrar na Cidadela"}
            </button>
          </form>
          <Link to="/" className="mt-6 text-sm text-muted-foreground hover:text-foreground">
            ← Voltar ao cardápio
          </Link>
        </div>
      ) : (
        <div className="min-h-screen">
          <TemporalLobby
            onNavigate={(module) => {
              if (module === "battle-arena") setActiveModule("arena");
              else if (module === "iq-test") setActiveModule("iq");
              else if (module === "chat-ai") setActiveModule("praxinha");
              else if (module === "robot-lab") setActiveModule("lab");
              else if (module === "trilha") setActiveModule("trilha");
            }}
          />
        </div>
      )}
    </div>
  );
}
