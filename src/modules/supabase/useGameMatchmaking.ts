import { useEffect, useState } from "react";
import { supabase, type GameSession, type GameMove, type GameType } from "./client";

export function useGameMatchmaking<T extends Record<string, unknown>>(
  gameType: GameType,
  playerData: T | null,
) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [searchTimeElapsed, setSearchTimeElapsed] = useState(0);
  const [playerId] = useState(
    () => `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  );

  // Timeout de 5 minutos para matchmaking
  const MATCHMAKING_TIMEOUT = 5 * 60 * 1000; // 5 minutos em ms

  useEffect(() => {
    let subscription: ReturnType<typeof supabase.channel> | null = null;

    async function subscribeToGameSessions() {
      subscription = supabase
        .channel(`games_${gameType}_channel`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "game_sessions",
            filter: `game_type=eq.${gameType}`,
          },
          (payload) => {
            console.log("Game session update:", payload);
            if (payload.new && typeof payload.new === "object" && "id" in payload.new) {
              const newSession = payload.new as GameSession;

              // Se eu sou player1 e a sessão mudou para active (player2 entrou)
              if (newSession.player1_id === playerId && newSession.status === "active") {
                setSession(newSession);
                setIsSearching(false);
                setIsMyTurn(true); // Player1 começa
                // Limpar timer de busca
                if (searchTimeout) {
                  clearTimeout(searchTimeout);
                  setSearchTimeout(null);
                }
                setSearchTimeElapsed(0);
              }

              // Se eu sou player2 e entrei na sessão
              if (newSession.player2_id === playerId && newSession.status === "active") {
                setSession(newSession);
                setIsSearching(false);
                setIsMyTurn(false); // Player2 espera player1
                // Limpar timer de busca
                if (searchTimeout) {
                  clearTimeout(searchTimeout);
                  setSearchTimeout(null);
                }
                setSearchTimeElapsed(0);
              }

              // Atualiza sessão existente
              if (session && newSession.id === session.id) {
                setSession(newSession);

                if (newSession.status === "active") {
                  const isPlayer1 = newSession.player1_id === playerId;
                  const currentTurn = newSession.current_turn;
                  setIsMyTurn(isPlayer1 ? currentTurn % 2 === 1 : currentTurn % 2 === 0);
                }
              }
            }
          },
        )
        .subscribe((status) => {
          console.log("Subscription status:", status);
        });
    }

    subscribeToGameSessions();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [gameType, playerId, session]);

  async function createSession(initialGameState: Record<string, unknown> = {}) {
    if (!playerData) return;

    setIsSearching(true);
    setSearchTimeElapsed(0);

    // Timer para contar tempo de busca
    const timer = setInterval(() => {
      setSearchTimeElapsed((prev) => prev + 1);
    }, 1000);

    // Timeout de 5 minutos
    const timeout = setTimeout(() => {
      setIsSearching(false);
      clearInterval(timer);
      setSearchTimeElapsed(0);
      alert("Tempo de busca esgotado. Nenhum oponente encontrado em 5 minutos.");
    }, MATCHMAKING_TIMEOUT);

    setSearchTimeout(timeout);

    const { data, error } = await supabase
      .from("game_sessions")
      .insert({
        game_type: gameType,
        player1_id: playerId,
        player1_name: playerData.name || "Player 1",
        player1_data: playerData,
        status: "waiting",
        current_turn: 1,
        game_state: initialGameState,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating game session:", error);
      setIsSearching(false);
      clearInterval(timer);
      clearTimeout(timeout);
      setSearchTimeElapsed(0);
      return;
    }

    setSession(data);
  }

  async function joinSession(sessionId: string) {
    if (!playerData) return;

    const { data, error } = await supabase
      .from("game_sessions")
      .update({
        player2_id: playerId,
        player2_name: playerData.name || "Player 2",
        player2_data: playerData,
        status: "active",
        current_turn: 1,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (error) {
      console.error("Error joining game session:", error);
      return;
    }

    setSession(data);
    setIsMyTurn(false);
  }

  async function sendMove(moveType: string, moveData: Record<string, unknown>) {
    if (!session) return;

    const playerNumber = session.player1_id === playerId ? 1 : 2;

    // Insere o movimento
    const { error: moveError } = await supabase.from("game_moves").insert({
      session_id: session.id,
      player_id: playerId,
      player_number: playerNumber,
      move_type: moveType,
      move_data: moveData,
      round_number: session.current_turn,
    });

    if (moveError) {
      console.error("Error sending move:", moveError);
      return;
    }

    // Atualiza o estado do jogo
    const nextTurn = session.current_turn + 1;
    const { data, error } = await supabase
      .from("game_sessions")
      .update({
        current_turn: nextTurn,
      })
      .eq("id", session.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating session:", error);
      return;
    }

    setSession(data);
    setIsMyTurn(false);
  }

  async function updateGameState(newGameState: Record<string, unknown>) {
    if (!session) return;

    const { data, error } = await supabase
      .from("game_sessions")
      .update({
        game_state: { ...session.game_state, ...newGameState },
      })
      .eq("id", session.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating game state:", error);
      return;
    }

    setSession(data);
  }

  async function completeSession(winner: string) {
    if (!session) return;

    const { data, error } = await supabase
      .from("game_sessions")
      .update({
        status: "completed",
        winner,
      })
      .eq("id", session.id)
      .select()
      .single();

    if (error) {
      console.error("Error completing session:", error);
      return;
    }

    setSession(data);
  }

  async function findAvailableSession() {
    const { data, error } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("game_type", gameType)
      .eq("status", "waiting")
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  async function getSessionMoves(sessionId: string) {
    const { data, error } = await supabase
      .from("game_moves")
      .select("*")
      .eq("session_id", sessionId)
      .order("timestamp", { ascending: true });

    if (error) {
      console.error("Error getting session moves:", error);
      return [];
    }

    return data as GameMove[];
  }

  return {
    session,
    isSearching,
    isMyTurn,
    playerId,
    searchTimeElapsed,
    createSession,
    joinSession,
    sendMove,
    updateGameState,
    completeSession,
    findAvailableSession,
    getSessionMoves,
  };
}
