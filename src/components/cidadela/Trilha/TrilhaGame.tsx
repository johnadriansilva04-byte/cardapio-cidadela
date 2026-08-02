import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { HQPanel } from "./HQPanel";
import { TrilhaBoard } from "./TrilhaBoard";
import { Button } from "@/components/ui/button";
import { AI_PROFILES, type Difficulty } from "@/lib/trilha/ai";
import { useBoardInteraction } from "@/hooks/useBoardInteraction";
import { useLocalGame } from "@/hooks/useLocalGame";
import { cn } from "@/lib/utils";
import { CobraFumando } from "@/components/CobraFumando";
import { Link } from "@tanstack/react-router";

const ORDER: Difficulty[] = ["recruta", "sargento", "general"];

export function TrilhaGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("sargento");
  const [seed, setSeed] = useState(0);
  return <TrilhaGameBoard key={`${difficulty}-${seed}`} difficulty={difficulty} onDifficulty={(d) => setDifficulty(d)} onReset={() => setSeed((s) => s + 1)} />;
}

function TrilhaGameBoard({
  difficulty,
  onDifficulty,
  onReset,
}: {
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  onReset: () => void;
}) {
  const game = useLocalGame(difficulty, 1);
  const interaction = useBoardInteraction(
    game.state,
    1,
    game.commit,
    !game.thinking && game.state.phase !== "over",
  );
  const isMobile = useIsMobile();

  const status = useMemo(() => {
    const s = game.state;
    if (s.phase === "over") {
      if (s.winner === 1) return "Vitória brasileira! O inimigo bateu em retirada.";
      const motive =
        s.reason === "blockade"
          ? "Suas tropas ficaram cercadas sem manobra."
          : s.reason === "resign"
            ? "Cessar-fogo solicitado."
            : "Sua tropa foi reduzida abaixo do mínimo operacional.";
      return `Derrota. ${motive}`;
    }
    if (interaction.awaitingCapture) return "TRILHA FECHADA! Selecione a peça inimiga a neutralizar.";
    if (game.thinking) return "Rádio em silêncio... o estado-maior inimigo calcula a resposta.";
    if (s.turn !== 1) return "Aguardando o inimigo.";
    if (s.phase === "placing") return `Desdobre um pracinha. Reserva: ${s.hand[1]}.`;
    if (interaction.flying) return "Esquadrão em voo: salte para qualquer interseção vazia.";
    return interaction.selected === null
      ? "Selecione um pracinha para manobrar."
      : "Escolha a interseção adjacente de destino.";
  }, [game.state, game.thinking, interaction.awaitingCapture, interaction.flying, interaction.selected]);

  const profile = AI_PROFILES[difficulty];

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-3">
          <CobraFumando className="size-8 sm:size-9 text-[color:var(--brass)]" />
          <div>
            <h2 className="text-stencil text-lg sm:text-xl">A TRILHA</h2>
            <p className="text-tech text-[8px] sm:text-[9px] text-muted-foreground">
              Jogo de estratégia tática · FEB vs Eixo
            </p>
          </div>
        </div>
        <Link 
          to="/cidadela" 
          className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar à Cidadela</span>
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Campanha</h1>
          </div>
          <div className="flex gap-2">
            {ORDER.map((d) => (
              <Button
                key={d}
                size="sm"
                variant={d === difficulty ? "default" : "secondary"}
                onClick={() => {
                  onDifficulty(d);
                  onReset();
                }}
              >
                {AI_PROFILES[d].label}
              </Button>
            ))}
          </div>
        </div>

      <div className={cn("flex gap-6 items-start", isMobile ? "flex-col" : "flex-row")}>
        <div className="flex flex-1 flex-col items-center">
          <TrilhaBoard
            state={game.state}
            perspective={1}
            selected={interaction.selected}
            targets={interaction.targets}
            captureTargets={interaction.captureTargets}
            lastMove={game.lastMove}
            interactive={!game.thinking}
            onNodeClick={interaction.handleNode}
          />
        </div>

        <HQPanel
          state={game.state}
          myPlayer={1}
          p1={{ name: "Pracinhas da FEB", slot: 1, subtitle: "Você" }}
          p2={{ name: `Comando inimigo`, slot: 2, subtitle: profile.label }}
          status={status}
          log={game.log}
          awaitingCapture={interaction.awaitingCapture}
          onRestart={onReset}
          onResign={game.resign}
        />
      </div>
    </main>
    </div>
  );
}
