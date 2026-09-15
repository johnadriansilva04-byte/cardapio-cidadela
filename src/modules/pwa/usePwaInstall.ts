import { useCallback, useEffect, useState } from "react";
import {
  captureInstallPrompt,
  dismissInstallPrompt,
  getInstallSnapshot,
  installInstructions,
  primeInstallSnapshot,
  promptInstall,
  resetInstallDismiss,
  subscribeInstall,
  type InstallSnapshot,
} from "./install";

export interface UsePwaInstall extends InstallSnapshot {
  /** Instala de verdade: usa o prompt nativo; se não houver, devolve "unavailable" */
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
  /** Instruções manuais (iOS/Android/desktop) quando não existe prompt nativo */
  instructions: string[];
  dismiss: () => void;
  reset: () => void;
}

export function usePwaInstall(): UsePwaInstall {
  const [snapshot, setSnapshot] = useState<InstallSnapshot>(() => primeInstallSnapshot());

  useEffect(() => {
    captureInstallPrompt();
    setSnapshot(getInstallSnapshot());
    return subscribeInstall(setSnapshot);
  }, []);

  const install = useCallback(() => promptInstall(), []);
  const dismiss = useCallback(() => dismissInstallPrompt(), []);
  const reset = useCallback(() => resetInstallDismiss(), []);

  return {
    ...snapshot,
    install,
    dismiss,
    reset,
    instructions: installInstructions(snapshot.platform),
  };
}
