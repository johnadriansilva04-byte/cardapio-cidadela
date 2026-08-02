import { useMemo, useState } from "react";
import { Brain, Cpu } from "lucide-react";
import { HQPanel } from "./HQPanel";
import { TrilhaBoard } from "./TrilhaBoard";
import { Button } from "@/components/ui/button";
import { AI_PROFILES, type Difficulty } from "@/lib/trilha/ai";
import { useBoardInteraction } from "@/hooks/useBoardInteraction";
import { useLocalGame } from "@/hooks/useLocalGame";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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
    <main className="mx-auto max-w-6xl px-4 py-4 sm:py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 sm:mb-6 sm:gap-4">
        <div>
          <p className="text-typewriter text-[10px] tracking-[0.3em] text-lantern sm:text-xs">OPERAÇÃO INDIVIDUAL</p>
          <h1 className="mt-1 text-xl sm:text-3xl">Campanha</h1>
        </div>
        <div className="flex flex-wrap gap-1 sm:gap-2">
          {ORDER.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={d === difficulty ? "default" : "secondary"}
              onClick={() => {
                onDifficulty(d);
                onReset();
              }}
              className="text-[10px] sm:text-xs"
            >
              {AI_PROFILES[d].label}
            </Button>
          ))}
        </div>
      </div>

      <div className={cn("flex gap-4 lg:items-start", isMobile ? "flex-col" : "flex-row")}>
        <div className="flex flex-1 flex-col items-center gap-3 sm:gap-4">
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
          <div className="panel-field w-full max-w-[min(78vh,640px)] rounded-md p-2 sm:p-3">
            <p className="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground sm:text-[10px]">
              <Brain className="h-3 w-3" /> Inteligência inimiga — {profile.label}
            </p>
            <p className="text-typewriter mt-1 text-[10px] leading-relaxed text-muted-foreground sm:text-[11px]">
              {profile.description}
            </p>
            {game.aiInfo && (
              <p
                className={cn(
                  "text-typewriter mt-2 flex items-center gap-2 text-[10px]",
                  game.thinking ? "text-lantern" : "text-muted-foreground",
                )}
              >
                <Cpu className="h-3 w-3" />
                Profundidade {game.aiInfo.depth} · {game.aiInfo.nodes.toLocaleString("pt-BR")} posições ·{" "}
                {game.aiInfo.elapsedMs} ms
              </p>
            )}
          </div>
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
  );
}
