import { useEffect, useRef, useCallback } from "react";
import { emptyInputs, type Inputs } from "./engine";

export function useTouchControls(enabled: boolean) {
  const inputs = useRef<Inputs>(emptyInputs());

  const setAction = useCallback((action: keyof Inputs, value: boolean) => {
    inputs.current[action] = value;
  }, []);

  useEffect(() => {
    if (!enabled) {
      inputs.current = emptyInputs();
      return;
    }

    return () => {
      inputs.current = emptyInputs();
    };
  }, [enabled]);

  return { inputs, setAction };
}
