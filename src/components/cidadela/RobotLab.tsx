import { useState } from "react";

import { useStore } from "@/modules/cidadela-core/store";
import type { RobotConfig } from "@/lib/types";

const IDEOLOGIES = [
  "Honor & Duty",
  "Freedom & Liberty",
  "Order & Discipline",
  "Progress & Innovation",
  "Tradition & Heritage",
];

const PERSONALITIES = ["Diplomatic", "Aggressive", "Analytical", "Charismatic", "Stoic"];

const STRATEGIES = [
  "Logical Arguments",
  "Emotional Appeal",
  "Historical Precedent",
  "Future Vision",
  "Moral Superiority",
];

export function RobotLab() {
  const { state, update } = useStore();
  const [config, setConfig] = useState<RobotConfig>({
    name: "Pracinha Bot",
    ideology: IDEOLOGIES[0],
    personality: PERSONALITIES[0],
    strategy: STRATEGIES[0],
    aggressiveness: 50,
    eloquence: 50,
    logic: 50,
  });

  function saveRobot() {
    update((prev) => ({
      ...prev,
      cidadela: {
        ...prev.cidadela,
        robots: [...prev.cidadela.robots, { ...config }],
      },
    }));
    setConfig({
      name: "Pracinha Bot",
      ideology: IDEOLOGIES[0],
      personality: PERSONALITIES[0],
      strategy: STRATEGIES[0],
      aggressiveness: 50,
      eloquence: 50,
      logic: 50,
    });
  }

  function loadRobot(robot: RobotConfig) {
    setConfig({ ...robot });
  }

  function deleteRobot(index: number) {
    update((prev) => ({
      ...prev,
      cidadela: {
        ...prev.cidadela,
        robots: prev.cidadela.robots.filter((_, i) => i !== index),
      },
    }));
  }

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col px-4">
      <div className="mx-auto w-full max-w-2xl py-6">
        <h2 className="text-stencil text-2xl">Laboratório de Robô</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure seu robô para usar no Pracinha IA e Arena de Batalha
        </p>

        <div className="mt-6 space-y-6 rounded-xl border border-border bg-secondary p-6">
          <div>
            <label className="block text-xs font-medium">Nome do Robô</label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-medium">Ideologia</label>
            <select
              value={config.ideology}
              onChange={(e) => setConfig({ ...config, ideology: e.target.value })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {IDEOLOGIES.map((ideology) => (
                <option key={ideology} value={ideology}>
                  {ideology}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium">Personalidade</label>
            <select
              value={config.personality}
              onChange={(e) => setConfig({ ...config, personality: e.target.value })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {PERSONALITIES.map((personality) => (
                <option key={personality} value={personality}>
                  {personality}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium">Estratégia de Debate</label>
            <select
              value={config.strategy}
              onChange={(e) => setConfig({ ...config, strategy: e.target.value })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {STRATEGIES.map((strategy) => (
                <option key={strategy} value={strategy}>
                  {strategy}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium">
                Agressividade: {config.aggressiveness}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={config.aggressiveness}
                onChange={(e) => setConfig({ ...config, aggressiveness: Number(e.target.value) })}
                className="mt-1 w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium">Eloquência: {config.eloquence}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={config.eloquence}
                onChange={(e) => setConfig({ ...config, eloquence: Number(e.target.value) })}
                className="mt-1 w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium">Lógica: {config.logic}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={config.logic}
                onChange={(e) => setConfig({ ...config, logic: Number(e.target.value) })}
                className="mt-1 w-full"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={saveRobot}
            className="text-tech w-full rounded-lg bg-[color:var(--brass)] py-3 text-sm text-[color:var(--matte)]"
          >
            Salvar Robô
          </button>
        </div>

        {state.cidadela.robots.length > 0 && (
          <div className="mt-6">
            <h3 className="text-stencil text-lg">Robôs Salvos</h3>
            <div className="mt-3 space-y-2">
              {state.cidadela.robots.map((robot, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{robot.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {robot.ideology} · {robot.personality}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => loadRobot(robot)}
                      className="rounded bg-background px-3 py-1 text-xs hover:bg-muted"
                    >
                      Carregar
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRobot(index)}
                      className="rounded bg-destructive/10 px-3 py-1 text-xs text-destructive hover:bg-destructive/20"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
