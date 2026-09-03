import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { TemporalLobby } from "@/components/cidadela/TemporalLobby";

export const Route = createFileRoute("/cidadela")({
  head: () => ({
    meta: [
      { title: "Cidadela" },
      {
        name: "description",
        content:
          "Cidadela — Mundo interativo dentro da plataforma Menu Digital.",
      },
    ],
  }),
  component: CidadelaWorld,
});

type Module = "praxinha" | "iq" | "arena" | "lab" | "futebol" | "trilha";

function CidadelaWorld() {
  const [activeModule, setActiveModule] = useState<Module | null>(null);

  if (activeModule) {
    return (
      <div className="min-h-screen bg-black">
        <header className="flex items-center justify-between border-b border-cyan-500/20 px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="text-lg font-bold text-white">CIDADELA</span>
          </Link>
          <button
            type="button"
            onClick={() => setActiveModule(null)}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
          >
            Voltar ao Mundo
          </button>
        </header>
        {/* Module components would render here */}
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-gray-500">
            Módulo em construção
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
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
  );
}
