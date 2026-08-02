import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/modules/supabase/client";
import {
  createBattle,
  emptyInputs,
  snapshot,
  stepBattle,
  type BattleState,
  type Inputs,
} from "./engine";
import { cpuInputs } from "./ai";
import { useKeyboard } from "./useKeyboard";

export type MatchMode = "cpu" | "online";

export type OnlineInfo = {
  sessionId: string;
  playerNumber: 1 | 2;
  playerId: string;
};

type Options = {
  mode: MatchMode;
  names: [string, string];
  levels?: [number, number];
  online?: OnlineInfo | null;
  running: boolean;
  touchInputs?: React.MutableRefObject<Inputs>;
};

/**
 * Runs the 60fps combat loop.
 * Online: player 1 is authoritative — it simulates and broadcasts state,
 * player 2 streams its inputs and renders the host snapshot.
 */
export function useBattleMatch({ mode, names, levels = [0, 0], online, running, touchInputs }: Options) {
  const [state, setState] = useState<BattleState>(() => createBattle(names[0], names[1], levels[0], levels[1]));
  const stateRef = useRef(state);
  stateRef.current = state;

  const keyboardInputs = useKeyboard(running);
  const remoteInputs = useRef<Inputs>(emptyInputs());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastPersist = useRef(0);
  const savedRef = useRef(false);
  const startedAt = useRef(Date.now());

  const isHost = mode === "cpu" || online?.playerNumber === 1;

  // Merge keyboard and touch inputs
  const localInputs = useRef<Inputs>(emptyInputs());
  
  useEffect(() => {
    if (!running) {
      localInputs.current = emptyInputs();
      return;
    }
    
    const updateInputs = () => {
      const merged: Inputs = {
        ...keyboardInputs.current,
        ...(touchInputs?.current || {})
      };
      localInputs.current = merged;
      if (Object.values(merged).some(v => v)) {
        console.log('Merged inputs:', merged);
      }
    };
    
    const interval = setInterval(updateInputs, 16); // ~60fps
    return () => clearInterval(interval);
  }, [running]);

  const reset = useCallback(() => {
    savedRef.current = false;
    startedAt.current = Date.now();
    setState(createBattle(names[0], names[1], levels[0], levels[1]));
  }, [names, levels]);

  // Realtime channel for online matches
  useEffect(() => {
    if (mode !== "online" || !online) return;
    const channel = supabase.channel(`battle:${online.sessionId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "inputs" }, ({ payload }) => {
        remoteInputs.current = payload as Inputs;
      })
      .on("broadcast", { event: "state" }, ({ payload }) => {
        if (online.playerNumber === 1) return;
        setState(payload as BattleState);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [mode, online]);

  // Main loop
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let broadcastAcc = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      broadcastAcc += dt;

      if (isHost) {
        const p1 = mode === "cpu" || online?.playerNumber === 1 ? localInputs.current : remoteInputs.current;
        const p2 =
          mode === "cpu"
            ? cpuInputs(stateRef.current, now / 1000)
            : remoteInputs.current;
        const next = stepBattle(stateRef.current, { ...p1 }, { ...p2 }, dt, now);
        stateRef.current = next;
        setState(next);

        if (mode === "online" && broadcastAcc > 1 / 20) {
          broadcastAcc = 0;
          channelRef.current?.send({ type: "broadcast", event: "state", payload: next });
        }
      } else if (broadcastAcc > 1 / 30) {
        broadcastAcc = 0;
        channelRef.current?.send({
          type: "broadcast",
          event: "inputs",
          payload: { ...localInputs.current },
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, isHost, mode, online]);

  // Persist rounds/moves and the final result (host only)
  useEffect(() => {
    if (mode !== "online" || !online || online.playerNumber !== 1) return;
    const now = Date.now();
    if (!state.finished && now - lastPersist.current < 1500) return;
    lastPersist.current = now;

    const payload = {
      current_turn: state.round,
      game_state: {
        topic: "arcade_fight",
        current_round: state.round,
        time_left: Math.round(state.timeLeft),
        robot1: snapshot(state.robot1),
        robot2: snapshot(state.robot2),
      },
      ...(state.finished ? { status: "completed", winner: state.winner } : {}),
    };
    void supabase.from("game_sessions").update(payload).eq("id", online.sessionId);

    if (state.finished && !savedRef.current) {
      savedRef.current = true;
      void persistResult(state, online.sessionId, startedAt.current);
    }
  }, [state, mode, online]);

  // CPU matches still record stats + history
  useEffect(() => {
    if (mode !== "cpu" || !state.finished || savedRef.current) return;
    savedRef.current = true;
    void persistResult(state, null, startedAt.current);
  }, [state, mode]);

  const logMove = useCallback(
    (moveType: string, data: Record<string, any>) => {
      if (mode !== "online" || !online) return;
      void supabase.from("game_moves").insert({
        session_id: online.sessionId,
        player_id: online.playerId,
        player_number: online.playerNumber,
        move_type: moveType,
        move_data: data,
        round_number: stateRef.current.round,
      });
    },
    [mode, online],
  );

  return { state, reset, logMove };
}

async function persistResult(state: BattleState, sessionId: string | null, startedAt: number) {
  const { robot1, robot2, winner } = state;
  
  // Tabela match_history não existe no schema atual, vamos usar game_sessions
  if (sessionId) {
    await supabase.from("game_sessions").update({
      status: "completed",
      winner,
      completed_at: new Date().toISOString(),
    }).eq("id", sessionId);
  }

  // Tabela robot_stats não existe no schema atual, vamos pular por enquanto
  // Futuramente pode ser adicionada ao schema
}
