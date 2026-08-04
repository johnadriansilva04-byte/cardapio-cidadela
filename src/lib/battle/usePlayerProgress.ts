import { useState, useEffect } from "react";
import { useStore } from "@/modules/cidadela-core/store";

const STORAGE_KEY = "cidade_battle_progress";

export type PlayerProgress = {
  wins: number;
  unlockedLevel: number;
  totalBattles: number;
};

const DEFAULT_PROGRESS: PlayerProgress = {
  wins: 0,
  unlockedLevel: 0,
  totalBattles: 0,
};

// Nível desbloqueado a cada 3 vitórias
const WINS_PER_LEVEL = 3;

export function usePlayerProgress() {
  const [progress, setProgress] = useState<PlayerProgress>(DEFAULT_PROGRESS);
  const { addSoberaniaPoints, removeSoberaniaPoints } = useStore();

  // Carregar progresso do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setProgress(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Erro ao carregar progresso:", e);
    }
  }, []);

  // Salvar progresso no localStorage
  const saveProgress = (newProgress: PlayerProgress) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
      setProgress(newProgress);
    } catch (e) {
      console.error("Erro ao salvar progresso:", e);
    }
  };

  // Adicionar vitória + ganhar pontos de soberania
  const addWin = () => {
    const newWins = progress.wins + 1;
    const newLevel = Math.floor(newWins / WINS_PER_LEVEL);
    const newProgress: PlayerProgress = {
      wins: newWins,
      unlockedLevel: Math.min(newLevel, 5), // Máximo nível 5
      totalBattles: progress.totalBattles + 1,
    };
    saveProgress(newProgress);
    
    // Ganhar pontos de soberania por vitória (100 pontos)
    addSoberaniaPoints(100, "Vitória na batalha", "game");
  };

  // Adicionar derrota + perder pontos de soberania
  const addLoss = () => {
    const newProgress: PlayerProgress = {
      ...progress,
      totalBattles: progress.totalBattles + 1,
    };
    saveProgress(newProgress);
    
    // Perder pontos de soberania por derrota (50 pontos)
    removeSoberaniaPoints(50, "Derrota na batalha", "game");
  };

  // Resetar progresso (para testes)
  const resetProgress = () => {
    saveProgress(DEFAULT_PROGRESS);
  };

  // Verificar se nível está desbloqueado
  const isLevelUnlocked = (level: number) => level <= progress.unlockedLevel;

  // Vitórias necessárias para próximo nível
  const winsToNextLevel = (progress.unlockedLevel + 1) * WINS_PER_LEVEL - progress.wins;

  return {
    progress,
    addWin,
    addLoss,
    resetProgress,
    isLevelUnlocked,
    winsToNextLevel,
  };
}
