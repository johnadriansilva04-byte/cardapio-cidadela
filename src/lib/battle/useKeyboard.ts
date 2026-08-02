import { useEffect, useRef } from "react";
import { emptyInputs, type Inputs } from "./engine";

const KEY_MAP: Record<string, keyof Inputs> = {
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyW: "jump",
  ArrowUp: "jump",
  KeyS: "crouch",
  ArrowDown: "crouch",
  KeyK: "shoot",
  Space: "shoot",
};

/** WASD to move/jump/crouch, K / Space to shoot. Returns a live mutable ref. */
export function useKeyboard(enabled: boolean) {
  const inputs = useRef<Inputs>(emptyInputs());

  useEffect(() => {
    if (!enabled) {
      inputs.current = emptyInputs();
      return;
    }
    const set = (code: string, value: boolean, event: KeyboardEvent) => {
      const key = KEY_MAP[code];
      if (!key) return;
      event.preventDefault();
      inputs.current[key] = value;
    };
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      set(e.code, true, e);
    };
    const up = (e: KeyboardEvent) => set(e.code, false, e);
    const blur = () => {
      inputs.current = emptyInputs();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [enabled]);

  return inputs;
}
