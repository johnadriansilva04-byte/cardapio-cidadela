import { useEffect, useRef } from "react";
import { emptyInputs, type Inputs } from "./engine";

export function useTouchControls(enabled: boolean) {
  const inputs = useRef<Inputs>(emptyInputs());

  useEffect(() => {
    if (!enabled) {
      inputs.current = emptyInputs();
      return;
    }

    const setAction = (action: keyof Inputs, value: boolean) => {
      inputs.current[action] = value;
    };

    return () => {
      inputs.current = emptyInputs();
    };
  }, [enabled]);

  return { inputs, setAction };
}
