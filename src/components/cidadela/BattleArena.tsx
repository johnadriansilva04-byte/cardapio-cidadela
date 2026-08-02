import { useState } from "react";

import { useStore } from "@/modules/cidadela-core/store";
import { Arena } from "@/components/battle/Arena";
import { useBattleMatch, type MatchMode, type OnlineInfo } from "@/lib/battle/useBattleMatch";
import { useGameMatchmaking } from "@/modules/supabase/useGameMatchmaking";
import type { RobotConfig } from "@/lib/types";

export function BattleArena() {
  const { state } = useStore();
  const [selectedRobot, setSelectedRobot] = useState<RobotConfig | null>(null);
  const [mode, setMode] = useState<MatchMode>("cpu");
  const [running, setRunning] = useState(false);
  const [onlineInfo, setOnlineInfo] = useState<OnlineInfo | null>(null);

  const { session, isSearching, searchTimeElapsed, createSession, findAvailableSession, joinSession } = 
    useGameMatchmaking<RobotConfig>("battle", selectedRobot);

  const { state: battleState, reset } = useBattleMatch({
    mode,
    names: [
      selectedRobot?.name || "Cobra Fumante",
      mode === "cpu" ? "CPU" : "Oponente"
    ],
    online: onlineInfo,
    running,
  });

  async function startCPUBattle() {
    setMode("cpu");
    setOnlineInfo(null);
    setRunning(true);
  }

  async function startOnlineBattle() {
    if (!selectedRobot) {
      alert("Selecione um robô primeiro!");
      return;
    }

    setMode("online");
    setRunning(false);

    // Tenta encontrar sessão disponível
    const availableSession = await findAvailableSession();
    if (availableSession) {
      // Entra como player 2
      await joinSession(availableSession.id);
      setOnlineInfo({
        sessionId: availableSession.id,
        playerNumber: 2,
        playerId: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      });
      setRunning(true);
      return;
    }

    // Cria nova sessão como player 1
    const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSession = await createSession({
      topic: "arcade_fight",
      current_round: 1,
      time_left: 90,
      robot1: {
        name: selectedRobot.name,
        ideology: selectedRobot.ideology,
      },
      robot2: {
        name: "Oponente",
        ideology: "Unknown",
      },
    });

    if (newSession) {
      setOnlineInfo({
        sessionId: newSession.id,
        playerNumber: 1,
        playerId,
      });
      setRunning(true);
    }
  }

  function handleRestart() {
    reset();
    setRunning(true);
  }

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col px-4">
      <div className="mx-auto w-full max-w-6xl py-6">
        <h2 className="text-stencil text-3xl">Arena de Batalha</h2>
        <p className="mt-2 text-sm text-muted-foreground">Luta arcade • Controles: WASD para mover, K/Enter/Space para atacar</p>

        {!running && (
          <div className="mt-6 rounded-xl border border-border bg-secondary p-6">
            <h3 className="text-stencil text-lg mb-4">Selecione seu Robô</h3>
            <div className="grid gap-3">
              {state.cidadela.robots.map((robot, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedRobot(robot)}
                  className={`text-left rounded-lg border px-4 py-3 transition-all ${
                    selectedRobot?.name === robot.name
                      ? "border-[color:var(--brass)] bg-[color:var(--brass)]/10"
                      : "border-border bg-background hover:border-[color:var(--brass)]/50"
                  }`}
                >
                  <p className="text-sm font-medium">🤖 {robot.name}</p>
                  <p className="text-xs text-muted-foreground">{robot.ideology}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={startCPUBattle}
                className="flex-1 rounded-lg bg-[color:var(--brass)] px-4 py-3 text-sm font-medium text-[color:var(--matte)] hover:bg-[color:var(--brass)]/90 transition-colors"
              >
                ⚔️ Batalha contra CPU
              </button>
              <button
                type="button"
                onClick={startOnlineBattle}
                disabled={!selectedRobot || isSearching}
                className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                🌐 Batalha Online
              </button>
            </div>

            {isSearching && (
              <div className="mt-4 rounded-lg border-2 border-yellow-500 bg-secondary px-4 py-3 text-center animate-pulse">
                <p className="text-sm font-medium text-yellow-500">⚔️ Buscando oponente...</p>
                <p className="text-xs text-muted-foreground">
                  Tempo de busca: {Math.floor(searchTimeElapsed / 60)}:{(searchTimeElapsed % 60).toString().padStart(2, '0')}
                </p>
                <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-1000"
                    style={{ width: `${(searchTimeElapsed / 300) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {running && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRunning(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Voltar para seleção
              </button>
              {battleState.finished && (
                <button
                  type="button"
                  onClick={handleRestart}
                  className="rounded-lg bg-[color:var(--brass)] px-4 py-2 text-sm font-medium text-[color:var(--matte)] hover:bg-[color:var(--brass)]/90 transition-colors"
                >
                  🔄 Reiniciar
                </button>
              )}
            </div>
            <Arena state={battleState} />
          </div>
        )}
      </div>
    </div>
  );
}
