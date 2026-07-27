import { useEffect, useState } from "react";
import { supabase, type Battle } from "./client";
import type { RobotConfig } from "@/lib/types";

export function useBattleMatchmaking(myRobot: RobotConfig | null) {
  const [battle, setBattle] = useState<Battle | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [playerId] = useState(
    () => `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  );

  useEffect(() => {
    let subscription: ReturnType<typeof supabase.channel> | null = null;

    async function subscribeToWaitingBattles() {
      subscription = supabase
        .channel("battles_channel")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "battles",
            filter: `status=eq.waiting`,
          },
          (payload) => {
            console.log("Battle update:", payload);
            if (payload.new) {
              const newBattle = payload.new as Battle;
              if (newBattle.player2_id === playerId) {
                setBattle(newBattle);
                setIsSearching(false);
                setIsMyTurn(true);
              }
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "battles",
          },
          (payload) => {
            if (battle && payload.new.id === battle.id) {
              const updatedBattle = payload.new as Battle;
              setBattle(updatedBattle);

              if (updatedBattle.status === "active") {
                const isPlayer1 = updatedBattle.player1_id === playerId;
                const currentRound = updatedBattle.current_round;
                setIsMyTurn(isPlayer1 ? currentRound % 2 === 1 : currentRound % 2 === 0);
              }
            }
          },
        )
        .subscribe();
    }

    subscribeToWaitingBattles();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [battle, playerId]);

  async function createBattle() {
    if (!myRobot) return;

    const topics = [
      "A importância da honra militar",
      "O papel da disciplina na sociedade",
      "Liberdade vs ordem",
      "Tradição vs progresso",
      "O dever de defender a pátria",
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    setIsSearching(true);

    const { data, error } = await supabase
      .from("battles")
      .insert({
        topic,
        player1_id: playerId,
        player1_name: myRobot.name,
        player1_robot: myRobot,
        status: "waiting",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating battle:", error);
      setIsSearching(false);
      return;
    }

    setBattle(data);
  }

  async function joinBattle(battleId: string) {
    if (!myRobot) return;

    const { data, error } = await supabase
      .from("battles")
      .update({
        player2_id: playerId,
        player2_name: myRobot.name,
        player2_robot: myRobot,
        status: "active",
        current_round: 1,
      })
      .eq("id", battleId)
      .select()
      .single();

    if (error) {
      console.error("Error joining battle:", error);
      return;
    }

    setBattle(data);
    setIsMyTurn(false);
  }

  async function sendArgument(argument: string) {
    if (!battle) return;

    const newMessages = [
      ...battle.messages,
      {
        id: Date.now(),
        player_id: playerId,
        text: argument,
        timestamp: new Date().toISOString(),
      },
    ];

    const nextRound = battle.current_round + 1;
    const isLastRound = nextRound > 6;

    const { data, error } = await supabase
      .from("battles")
      .update({
        messages: newMessages,
        current_round: nextRound,
        status: isLastRound ? "completed" : "active",
      })
      .eq("id", battle.id)
      .select()
      .single();

    if (error) {
      console.error("Error sending argument:", error);
      return;
    }

    setBattle(data);
    setIsMyTurn(false);
  }

  async function findAvailableBattle() {
    const { data, error } = await supabase
      .from("battles")
      .select("*")
      .eq("status", "waiting")
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  return {
    battle,
    isSearching,
    isMyTurn,
    playerId,
    createBattle,
    joinBattle,
    sendArgument,
    findAvailableBattle,
  };
}
