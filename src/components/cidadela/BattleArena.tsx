import { useState } from "react";

import { useStore } from "@/modules/cidadela-core/store";
import type { RobotConfig } from "@/lib/types";
import { useGameMatchmaking } from "@/modules/supabase/useGameMatchmaking";
import type { BattleGameState, BattleRobot } from "@/modules/supabase/client";

const DEFAULT_TOPICS = [
  "A eugenia burocrática: políticas de controle populacional",
  "A força instituição brasileira foi a primeira vítima dessa eugenia",
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
  const { state, update } = useStore();
  const [selectedMyRobot, setSelectedMyRobot] = useState<RobotConfig | null>(null);
  const [inputArgument, setInputArgument] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showTopicSelector, setShowTopicSelector] = useState(true);
  const [newTopicName, setNewTopicName] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);

  const {
    session,
    isSearching,
    isMyTurn,
    searchTimeElapsed,
    createSession,
    sendMove,
    updateGameState,
    findAvailableSession,
    joinSession,
  } = useGameMatchmaking<BattleRobot>("battle", selectedMyRobot);

  async function startBattle() {
    if (!selectedMyRobot) {
      alert("Selecione um robô primeiro!");
      return;
    }
    if (!selectedTopic) {
      alert("Selecione um assunto primeiro!");
      return;
    }

    const robot2: BattleRobot = {
      name: "Oponente",
      ideology: "Freedom & Liberty",
      personality: "Diplomatic",
      strategy: "Logical Arguments",
      aggressiveness: 30,
      eloquence: 80,
      logic: 90,
      hp: 100,
    };

    const initialGameState: BattleGameState = {
      topic: selectedTopic,
      current_round: 1,
      messages: [],
      robot1: selectedMyRobot as BattleRobot,
      robot2,
    };

    // Primeiro tenta encontrar uma sessão disponível
    const availableSession = await findAvailableSession();
    if (availableSession) {
      // Se encontrou, entra na sessão existente
      await joinSession(availableSession.id);
      setShowTopicSelector(false);
      return;
    }

    // Se não encontrou, cria uma nova sessão
    await createSession(initialGameState);
    setShowTopicSelector(false);
  }

  function handleCreateCustomTopic() {
    if (!state.cidadela.isPremium && state.cidadela.customTopics.length >= 1) {
      setShowPaywall(true);
      return;
    }
    if (!newTopicName.trim()) {
      alert("Digite um nome para o assunto!");
      return;
    }
    const newTopic = {
      id: Date.now().toString(),
      name: newTopicName.trim(),
      createdAt: new Date().toISOString(),
    };
    update((prev) => ({
      ...prev,
      cidadela: {
        ...prev.cidadela,
        customTopics: [...prev.cidadela.customTopics, newTopic],
      },
    }));
    setNewTopicName("");
    setSelectedTopic(newTopic.name);
  }

  function handleUnlockPremium() {
    const whatsappNumber = state.whatsapp || "5511999999999";
    const message = encodeURIComponent(
      "Olá! Gostaria de desbloquear o plano Premium da Arena de Batalha por R$98,99/semestral.",
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  }

  function getAvailableTopics() {
    return [...DEFAULT_TOPICS, ...state.cidadela.customTopics.map((t) => t.name)];
  }

  async function handleSendArgument() {
    if (!inputArgument.trim() || !isMyTurn || !session) return;
    
    const gameState = session.game_state as BattleGameState;
    const currentTurn = session.current_turn;
    const isPlayer1Turn = currentTurn % 2 === 1;
    const currentPlayerId = isPlayer1Turn ? session.player1_id : session.player2_id;
    
    const newMessage = {
      id: Date.now(),
      player_id: currentPlayerId,
      text: inputArgument,
      timestamp: new Date().toISOString(),
    };

    const updatedGameState: BattleGameState = {
      ...gameState,
      messages: [...gameState.messages, newMessage],
      current_round: gameState.current_round + 1,
    };

    await updateGameState(updatedGameState);
    await sendMove("argument", { text: inputArgument });
    setInputArgument("");
  }

  const gameState = session?.game_state as BattleGameState | undefined;
  const robot1 = gameState?.robot1 || {
    name: "Cobra Fumante",
    ideology: "Honor & Duty",
    personality: "Aggressive",
    strategy: "Moral Superiority",
    aggressiveness: 80,
    eloquence: 70,
    logic: 60,
    hp: 100,
  };

  const robot2 = gameState?.robot2 || {
    name: "Monte Castelo",
    ideology: "Freedom & Liberty",
    personality: "Diplomatic",
    strategy: "Logical Arguments",
    aggressiveness: 30,
    eloquence: 80,
    logic: 90,
    hp: 100,
  };

  // Calcular HP baseado nos argumentos
  const calculateHP = (messages: any[], isPlayer1: boolean) => {
    if (!session) return 100;
    const playerMessages = messages.filter((m) => 
      isPlayer1 ? m.player_id === session.player1_id : m.player_id === session.player2_id
    ).length;
    const baseHP = 100;
    const damagePerRound = 10;
    const damage = playerMessages * damagePerRound;
    return Math.max(0, baseHP - damage);
  };

  const robot1HP = gameState ? calculateHP(gameState.messages, true) : robot1.hp;
  const robot2HP = gameState ? calculateHP(gameState.messages, false) : robot2.hp;

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col px-4">
      <div className="mx-auto w-full max-w-4xl py-6">
        <h2 className="text-stencil text-2xl">Arena de Batalha</h2>
        <p className="mt-2 text-sm text-muted-foreground">6 rodadas • Sistema de vida</p>

        {showTopicSelector && (
          <div className="mt-6 rounded-xl border border-border bg-secondary p-6">
            <h3 className="text-stencil text-lg mb-4">Assunto do Debate</h3>
            <div className="grid gap-3">
              {DEFAULT_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setSelectedTopic(topic)}
                  className={`text-left rounded-lg border px-4 py-3 transition-all ${
                    selectedTopic === topic
                      ? "border-[color:var(--brass)] bg-[color:var(--brass)]/10"
                      : "border-border bg-background hover:border-[color:var(--brass)]/50"
                  }`}
                >
                  <p className="text-sm font-medium">{topic}</p>
                </button>
              ))}
              {state.cidadela.customTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setSelectedTopic(topic.name)}
                  className={`text-left rounded-lg border px-4 py-3 transition-all ${
                    selectedTopic === topic.name
                      ? "border-[color:var(--brass)] bg-[color:var(--brass)]/10"
                      : "border-border bg-background hover:border-[color:var(--brass)]/50"
                  }`}
                >
                  <p className="text-sm font-medium">{topic.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Customizado</p>
                </button>
              ))}
              <div className="rounded-lg border border-dashed border-border bg-background/50 p-4">
                <div className="flex gap-2">
                  <input
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    placeholder="Novo assunto..."
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCustomTopic}
                    disabled={!state.cidadela.isPremium && state.cidadela.customTopics.length >= 1}
                    className="rounded-lg bg-[color:var(--brass)] px-4 py-2 text-sm text-[color:var(--matte)] disabled:opacity-50"
                  >
                    Criar
                  </button>
                </div>
                {!state.cidadela.isPremium && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Grátis: {state.cidadela.customTopics.length}/1
                  </p>
                )}
              </div>
            </div>
            {selectedTopic && (
              <button
                type="button"
                onClick={() => setShowTopicSelector(false)}
                className="mt-4 w-full rounded-lg bg-[color:var(--brass)] px-4 py-3 text-sm font-medium text-[color:var(--matte)]"
              >
                Selecionar Robô
              </button>
            )}
          </div>
        )}

        {showPaywall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="mx-4 max-w-md rounded-xl border border-border bg-secondary p-6">
              <h3 className="text-stencil text-xl mb-2">🔒 Desbloquear Premium</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Limite atingido. Desbloqueie para criar ilimitados.
              </p>
              <div className="rounded-lg bg-background p-4 mb-4">
                <p className="text-lg font-bold text-[color:var(--brass)]">R$98,99/semestral</p>
                <p className="text-xs text-muted-foreground mt-1">Ilimitados</p>
              </div>
              <button
                type="button"
                onClick={handleUnlockPremium}
                className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors"
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setShowPaywall(false)}
                className="mt-2 w-full rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-background transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className={`rounded-xl border-2 p-4 transition-all ${
            robot1HP < 30 
              ? 'border-red-500 bg-red-500/10 animate-pulse' 
              : robot1HP < 50 
                ? 'border-yellow-500 bg-yellow-500/10' 
                : 'border-green-500/50 bg-secondary'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className="text-stencil text-lg">🤖 {robot1.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">HP</span>
                <div className="h-3 w-28 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      robot1HP < 30 
                        ? 'bg-red-500' 
                        : robot1HP < 50 
                          ? 'bg-yellow-500' 
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${robot1HP}%` }}
                  />
                </div>
                <span className={`text-xs font-bold ${
                  robot1HP < 30 ? 'text-red-500' : robot1HP < 50 ? 'text-yellow-500' : 'text-green-500'
                }`}>{robot1HP}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">💭 {robot1.ideology}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-background/50 p-2">
                <p className="text-muted-foreground">Personalidade</p>
                <p className="font-medium">{robot1.personality}</p>
              </div>
              <div className="rounded bg-background/50 p-2">
                <p className="text-muted-foreground">Estratégia</p>
                <p className="font-medium">{robot1.strategy}</p>
              </div>
              <div className="rounded bg-background/50 p-2">
                <p className="text-muted-foreground">Agressividade</p>
                <p className="font-medium">{robot1.aggressiveness}%</p>
              </div>
              <div className="rounded bg-background/50 p-2">
                <p className="text-muted-foreground">Eloquência</p>
                <p className="font-medium">{robot1.eloquence}%</p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl border-2 p-4 transition-all ${
            robot2HP < 30 
              ? 'border-red-500 bg-red-500/10 animate-pulse' 
              : robot2HP < 50 
                ? 'border-yellow-500 bg-yellow-500/10' 
                : 'border-blue-500/50 bg-secondary'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className="text-stencil text-lg">🤖 {robot2.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">HP</span>
                <div className="h-3 w-28 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      robot2HP < 30 
                        ? 'bg-red-500' 
                        : robot2HP < 50 
                          ? 'bg-yellow-500' 
                          : 'bg-blue-500'
                    }`}
                    style={{ width: `${robot2HP}%` }}
                  />
                </div>
                <span className={`text-xs font-bold ${
                  robot2HP < 30 ? 'text-red-500' : robot2HP < 50 ? 'text-yellow-500' : 'text-blue-500'
                }`}>{robot2HP}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">💭 {robot2.ideology}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-background/50 p-2">
                <p className="text-muted-foreground">Personalidade</p>
                <p className="font-medium">{robot2.personality}</p>
              </div>
              <div className="rounded bg-background/50 p-2">
                <p className="text-muted-foreground">Estratégia</p>
                <p className="font-medium">{robot2.strategy}</p>
              </div>
              <div className="rounded bg-background/50 p-2">
                <p className="text-muted-foreground">Agressividade</p>
                <p className="font-medium">{robot2.aggressiveness}%</p>
              </div>
              <div className="rounded bg-background/50 p-2">
                <p className="text-muted-foreground">Eloquência</p>
                <p className="font-medium">{robot2.eloquence}%</p>
              </div>
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
            <p className="text-xs text-muted-foreground mt-2">
              Aguardando outro guerreiro entrar na arena
            </p>
          </div>
        )}

        {session && (
          <div className="mt-4 rounded-lg border-2 border-[color:var(--brass)] bg-secondary px-4 py-3 text-center shadow-lg shadow-[color:var(--brass)]/20">
            <p className="text-sm font-bold text-[color:var(--brass)]">⚔️ {gameState?.topic}</p>
            {session.status === "waiting" && (
              <p className="text-xs text-yellow-400 animate-pulse">⏳ Aguardando oponente...</p>
            )}
            {session.status === "active" && (
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-muted-foreground">Rodada {gameState?.current_round}/6</span>
                <div className="flex gap-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-full ${
                        i < (gameState?.current_round || 0) - 1
                          ? "bg-green-500"
                          : i === (gameState?.current_round || 0) - 1
                            ? "bg-yellow-500 animate-pulse"
                            : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
            {session.status === "completed" && (
              <p className="text-xs text-green-400 font-bold">🏆 Batalha finalizada!</p>
            )}
            {isMyTurn && session.status === "active" && (
              <p className="text-xs text-green-400 font-bold animate-bounce">⚡ SUA VEZ! ⚡</p>
            )}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-border bg-secondary p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-stencil text-lg">Debate</h3>
            <button
              type="button"
              onClick={startBattle}
              disabled={session?.status === "active" || isSearching}
              className="text-tech rounded-lg bg-[color:var(--brass)] px-4 py-2 text-sm text-[color:var(--matte)] disabled:opacity-50"
            >
              {isSearching
                ? "Buscando..."
                : session?.status === "active"
                  ? "Em andamento"
                  : "Iniciar Batalha"}
            </button>
          </div>

          <div className="max-h-80 space-y-3 overflow-y-auto">
            {!session && (
              <p className="text-center text-sm text-muted-foreground">
                Clique em "Iniciar Batalha" para buscar um oponente e começar o debate
              </p>
            )}
            {gameState?.messages.map((msg) => {
              const isPlayer1 = msg.player_id === session?.player1_id;
              return (
                <div
                  key={msg.id}
                  className={`rounded-lg px-4 py-2 border-l-4 ${
                    isPlayer1 
                      ? "border-red-500 bg-red-500/10" 
                      : "border-blue-500 bg-blue-500/10"
                  }`}
                >
                  <p className="text-xs font-medium">
                    {isPlayer1 ? session?.player1_name : session?.player2_name}
                  </p>
                  <p className="mt-1 text-sm">{msg.text}</p>
                </div>
              );
            })}
          </div>

          {session?.status === "active" && isMyTurn && (
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
            <strong>Como funciona:</strong> Cada argumento causa dano baseado em eloquência, lógica
            e agressividade. O robô com maior defesa reduz o dano recebido. 6 rodadas ou até um robô
            perder todo o HP.
          </p>
        </div>
      </div>
    </div>
  );
}
