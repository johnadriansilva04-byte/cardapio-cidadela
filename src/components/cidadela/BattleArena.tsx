import { useState } from "react";

import { useStore } from "@/modules/cidadela-core/store";
import type { RobotConfig } from "@/lib/types";

type Message = {
  id: number;
  robot: string;
  text: string;
  timestamp: Date;
};

type Robot = {
  name: string;
  ideology: string;
  personality: string;
  strategy: string;
  aggressiveness: number;
  eloquence: number;
  logic: number;
  hp: number;
};

const TOPICS = [
  "A importância da honra militar",
  "O papel da disciplina na sociedade",
  "Liberdade vs ordem",
  "Tradição vs progresso",
  "O dever de defender a pátria",
];

const ARGUMENTS: Record<string, string[]> = {
  "Honor & Duty": [
    "A honra é o alicerce de toda sociedade civilizada.",
    "O dever para com a nação transcende interesses pessoais.",
    "Sem honra, não há dignidade possível.",
    "O sacrifício pelo dever é a maior expressão de honra.",
  ],
  "Freedom & Liberty": [
    "A liberdade individual é o direito supremo de todo ser humano.",
    "A ordem sem liberdade é tirania disfarçada.",
    "O progresso só é possível com liberdade de expressão.",
    "A autodeterminação é inegociável.",
  ],
  "Order & Discipline": [
    "Sem disciplina, a sociedade desaba em caos.",
    "A ordem é necessária para proteger a liberdade de todos.",
    "A hierarquia é natural e necessária.",
    "O respeito à autoridade mantém a paz social.",
  ],
  "Progress & Innovation": [
    "A tradição que não evolui morre.",
    "O progresso é a única constante na história.",
    "A inovação é a chave para sobrevivência.",
    "O futuro pertence aos que ousam mudar.",
  ],
  "Tradition & Heritage": [
    "Nossas raízes definem quem somos.",
    "Abandonar a tradição é perder a identidade.",
    "O passado contém lições valiosas para o presente.",
    "A herança cultural deve ser preservada a todo custo.",
  ],
};

export function BattleArena() {
  const { state } = useStore();
  const [selectedMyRobot, setSelectedMyRobot] = useState<RobotConfig | null>(null);
  const [inputArgument, setInputArgument] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [battle, setBattle] = useState<any>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);

  function startBattle() {
    if (!selectedMyRobot) {
      alert("Selecione um robô primeiro!");
      return;
    }
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      setBattle({
        topic: "A importância da honra militar",
        status: "active",
        current_round: 1,
        player1_name: selectedMyRobot.name,
        player2_name: "Oponente",
        messages: [],
      });
      setIsMyTurn(true);
    }, 2000);
  }

  function handleSendArgument() {
    if (!inputArgument.trim() || !isMyTurn) return;
    setBattle((prev: any) => ({
      ...prev,
      messages: [...prev.messages, { id: Date.now(), text: inputArgument }],
      current_round: prev.current_round + 1,
    }));
    setInputArgument("");
    setIsMyTurn(false);
    setTimeout(() => setIsMyTurn(true), 1500);
  }

  const robot1 = battle?.player1_robot || {
    name: "Cobra Fumante",
    ideology: "Honor & Duty",
    personality: "Aggressive",
    strategy: "Moral Superiority",
    aggressiveness: 80,
    eloquence: 70,
    logic: 60,
    hp: 100,
  };

  const robot2 = battle?.player2_robot || {
    name: "Monte Castelo",
    ideology: "Freedom & Liberty",
    personality: "Diplomatic",
    strategy: "Logical Arguments",
    aggressiveness: 30,
    eloquence: 80,
    logic: 90,
    hp: 100,
  };

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col px-4">
      <div className="mx-auto w-full max-w-4xl py-6">
        <h2 className="text-stencil text-2xl">Arena de Batalha</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Robôs debatendo ideologia · 6 rodadas · Sistema de vida
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-secondary p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-stencil text-lg">{robot1.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">HP</span>
                <div className="h-2 w-24 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all"
                    style={{ width: `${robot1.hp}%` }}
                  />
                </div>
                <span className="text-xs font-bold">{robot1.hp}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{robot1.ideology}</p>
            <div className="mt-2 space-y-1 text-xs">
              <p>Personalidade: {robot1.personality}</p>
              <p>Estratégia: {robot1.strategy}</p>
              <p>Agressividade: {robot1.aggressiveness}%</p>
              <p>Eloquência: {robot1.eloquence}%</p>
              <p>Lógica: {robot1.logic}%</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-stencil text-lg">{robot2.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">HP</span>
                <div className="h-2 w-24 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${robot2.hp}%` }}
                  />
                </div>
                <span className="text-xs font-bold">{robot2.hp}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{robot2.ideology}</p>
            <div className="mt-2 space-y-1 text-xs">
              <p>Personalidade: {robot2.personality}</p>
              <p>Estratégia: {robot2.strategy}</p>
              <p>Agressividade: {robot2.aggressiveness}%</p>
              <p>Eloquência: {robot2.eloquence}%</p>
              <p>Lógica: {robot2.logic}%</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-secondary p-4">
          <label className="block text-xs font-medium mb-2">Selecione seu robô (opcional)</label>
          <select
            value={selectedMyRobot?.name || ""}
            onChange={(e) => {
              const robot = state.cidadela.robots.find((r) => r.name === e.target.value);
              setSelectedMyRobot(robot || null);
            }}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Usar robô padrão</option>
            {state.cidadela.robots.map((robot, index) => (
              <option key={index} value={robot.name}>
                {robot.name} ({robot.ideology})
              </option>
            ))}
          </select>
        </div>

        {isSearching && (
          <div className="mt-4 rounded-lg border-2 border-yellow-500 bg-secondary px-4 py-3 text-center">
            <p className="text-sm font-medium">Buscando oponente...</p>
            <p className="text-xs text-muted-foreground">Aguardando outro jogador entrar na arena</p>
          </div>
        )}

        {battle && (
          <div className="mt-4 rounded-lg border border-[color:var(--brass)] bg-secondary px-4 py-2 text-center">
            <p className="text-sm font-medium">Tema do Debate: {battle.topic}</p>
            {battle.status === "active" && (
              <p className="text-xs text-muted-foreground">Rodada {battle.current_round}/6</p>
            )}
            {isMyTurn && (
              <p className="text-xs text-green-400 font-medium">Sua vez!</p>
            )}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-border bg-secondary p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-stencil text-lg">Debate</h3>
            <button
              type="button"
              onClick={startBattle}
              disabled={battle?.status === "active" || isSearching}
              className="text-tech rounded-lg bg-[color:var(--brass)] px-4 py-2 text-sm text-[color:var(--matte)] disabled:opacity-50"
            >
              {isSearching ? "Buscando..." : battle?.status === "active" ? "Em andamento" : "Iniciar Batalha"}
            </button>
          </div>

          <div className="max-h-80 space-y-3 overflow-y-auto">
            {!battle && (
              <p className="text-center text-sm text-muted-foreground">
                Clique em "Iniciar Batalha" para buscar um oponente e começar o debate
              </p>
            )}
            {battle?.messages.map((msg: any) => (
              <div
                key={msg.id}
                className="rounded-lg px-4 py-2 border-l-4 border-red-500 bg-red-500/10"
              >
                <p className="text-xs font-medium">{battle.player1_name}</p>
                <p className="mt-1 text-sm">{msg.text}</p>
              </div>
            ))}
          </div>

          {battle?.status === "active" && isMyTurn && (
            <div className="mt-4 flex gap-2">
              <input
                value={inputArgument}
                onChange={(e) => setInputArgument(e.target.value)}
                placeholder="Digite seu argumento..."
                className="flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={handleSendArgument}
                className="rounded-lg bg-[color:var(--brass)] px-4 py-2 text-sm text-[color:var(--matte)]"
              >
                Enviar
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-secondary px-4 py-3">
          <p className="text-xs text-muted-foreground">
            <strong>Como funciona:</strong> Cada argumento causa dano baseado em eloquência, lógica e agressividade. 
            O robô com maior defesa reduz o dano recebido. 6 rodadas ou até um robô perder todo o HP.
          </p>
        </div>
      </div>
    </div>
  );
}
