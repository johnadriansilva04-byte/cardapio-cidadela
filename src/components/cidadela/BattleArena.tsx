import { useState, useEffect } from "react";

import { useStore } from "@/modules/cidadela-core/store";
import { Arena } from "@/components/battle/Arena";
import { useBattleMatch, type MatchMode, type OnlineInfo } from "@/lib/battle/useBattleMatch";
import { useGameMatchmaking } from "@/modules/supabase/useGameMatchmaking";
import { usePlayerProgress } from "@/lib/battle/usePlayerProgress";
import type { RobotConfig } from "@/lib/types";

export function BattleArena() {
  const { state } = useStore();
  const [selectedRobot, setSelectedRobot] = useState<RobotConfig | null>(null);
  const [mode, setMode] = useState<MatchMode>("cpu");
  const [running, setRunning] = useState(false);
  const [onlineInfo, setOnlineInfo] = useState<OnlineInfo | null>(null);
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(0);

  const { progress, addWin, addLoss, isLevelUnlocked, winsToNextLevel } = usePlayerProgress();

  const { session, isSearching, searchTimeElapsed, createSession, findAvailableSession, joinSession } = 
    useGameMatchmaking<RobotConfig>("battle", selectedRobot);

  const { state: battleState, reset } = useBattleMatch({
    mode,
    names: [
      selectedRobot?.name || "Cobra Fumante",
      mode === "cpu" ? "CPU" : "Oponente"
    ],
    levels: [selectedLevel, mode === "cpu" ? Math.min(progress.unlockedLevel, 2) : 0],
    online: onlineInfo,
    running,
  });

  async function startCPUBattle() {
    setMode("cpu");
    setOnlineInfo(null);
    setRunning(true);
  }

  // Monitorar fim da batalha para registrar progresso
  useEffect(() => {
    if (battleState.finished && running && mode === "cpu") {
      if (battleState.winner === (selectedRobot?.name || "Cobra Fumante")) {
        addWin();
      } else {
        addLoss();
      }
    }
  }, [battleState.finished, running, mode, selectedRobot?.name]);

  async function startOnlineBattle() {
    if (!selectedRobot) {
      alert("Selecione um robô primeiro!");
      return;
    }

    // Bloquear online até nível 3
    if (progress.unlockedLevel < 3) {
      alert(`Você precisa alcançar o nível 3 para jogar online! Vitórias necessárias: ${3 * 3 - progress.wins}`);
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
        <h2 className="text-stencil text-3xl">Arena de Batalha - FEB</h2>
        <p className="mt-2 text-sm text-muted-foreground">Força Expedicionária Brasileira • Luta arcade com armas • Controles: WASD para mover/pular/abaixar, K/Space para atirar</p>
        
        {/* Progresso do jogador */}
        <div className="mt-4 rounded-lg border-2 border-green-700 bg-green-950/40 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-400">🎖️ Progresso do Pracinha</p>
              <p className="text-xs text-green-300/70">
                Vitórias: {progress.wins} | Patente: Nível {progress.unlockedLevel} | Campanhas: {progress.totalBattles}
              </p>
            </div>
            {progress.unlockedLevel < 5 && (
              <div className="text-right">
                <p className="text-xs text-green-300/70">Próxima patente:</p>
                <p className="text-sm font-medium text-green-400">{winsToNextLevel} vitórias</p>
              </div>
            )}
          </div>
        </div>

        {!running && (
          <div className="mt-6 rounded-xl border-2 border-green-700 bg-green-950/40 p-6">
            <h3 className="text-stencil text-lg mb-4 text-green-400">🤖 Selecione seu Robô de Combate</h3>
            <div className="grid gap-3">
              {state.cidadela.robots.map((robot, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedRobot(robot)}
                  className={`text-left rounded-lg border px-4 py-3 transition-all ${
                    selectedRobot?.name === robot.name
                      ? "border-green-500 bg-green-800/30"
                      : "border-green-800 bg-green-950/50 hover:border-green-600"
                  }`}
                >
                  <p className="text-sm font-medium text-green-300">🤖 {robot.name}</p>
                  <p className="text-xs text-green-400/70">{robot.ideology}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={startCPUBattle}
                className="flex-1 rounded-lg bg-green-700 px-4 py-3 text-sm font-medium text-white hover:bg-green-600 transition-colors"
              >
                ⚔️ Treinamento (CPU)
              </button>
              <button
                type="button"
                onClick={() => setShowLevelMenu(true)}
                className="flex-1 rounded-lg border-2 border-green-600 bg-green-950/50 px-4 py-3 text-sm font-medium text-green-400 hover:bg-green-800/30 transition-colors"
              >
                🎖️ Patentes
              </button>
              <button
                type="button"
                onClick={startOnlineBattle}
                disabled={!selectedRobot || isSearching || progress.unlockedLevel < 3}
                className="flex-1 rounded-lg bg-yellow-600 px-4 py-3 text-sm font-medium text-white hover:bg-yellow-500 transition-colors disabled:opacity-50"
              >
                🌐 Campanha Online
              </button>
            </div>

            {isSearching && (
              <div className="mt-4 rounded-lg border-2 border-yellow-500 bg-yellow-950/30 px-4 py-3 text-center animate-pulse">
                <p className="text-sm font-medium text-yellow-500">⚔️ Buscando camarada...</p>
                <p className="text-xs text-yellow-400/70">
                  Tempo de busca: {Math.floor(searchTimeElapsed / 60)}:{(searchTimeElapsed % 60).toString().padStart(2, '0')}
                </p>
                <div className="mt-2 h-2 w-full rounded-full bg-yellow-900 overflow-hidden">
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

        {/* Modal de seleção de níveis */}
        {showLevelMenu && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
            <div className="w-full max-w-2xl rounded-xl border-2 border-green-700 bg-green-950/90 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-stencil text-xl text-green-400">🎖️ Patentes Desbloqueadas</h3>
                <button
                  type="button"
                  onClick={() => setShowLevelMenu(false)}
                  className="text-green-400 hover:text-green-300 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-4 text-sm text-green-300/70">
                <p>Patente atual: <span className="font-medium text-green-400">Nível {progress.unlockedLevel}</span></p>
                <p>Ganhe 3 vitórias contra CPU para promover à próxima patente</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2, 3, 4, 5].map((level) => {
                  const unlocked = isLevelUnlocked(level);
                  const weaponNames: Record<number, string> = {
                    0: "Recruta (Sem arma)",
                    1: "Cabo (Pistola)",
                    2: "Sargento (Pistola)",
                    3: "Tenente (Rifle)",
                    4: "Capitão (Rifle)",
                    5: "Major (Shotgun)",
                  };
                  
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        if (unlocked) {
                          setSelectedLevel(level);
                          setShowLevelMenu(false);
                        }
                      }}
                      disabled={!unlocked}
                      className={`rounded-lg border px-4 py-3 transition-all ${
                        selectedLevel === level
                          ? "border-green-500 bg-green-800/40"
                          : unlocked
                          ? "border-green-800 bg-green-950/50 hover:bg-green-800/30"
                          : "border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <p className="text-sm font-medium text-green-400">Nível {level}</p>
                      <p className="text-xs text-green-300/70">{weaponNames[level]}</p>
                      {!unlocked && (
                        <p className="text-xs text-gray-500">🔒 Bloqueado</p>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 text-center">
                <p className="text-xs text-green-300/50">
                  Patente selecionada: <span className="font-medium text-green-400">Nível {selectedLevel}</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
