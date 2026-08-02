import { useEffect, useRef, useCallback, useState } from "react";
import { emptyInputs, type Inputs } from "./engine";

export function useTouchControls(enabled: boolean) {
  const inputs = useRef<Inputs>(emptyInputs());
  const joystickActive = useRef(false);
  const joystickStartPos = useRef({ x: 0, y: 0 });
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });

  const setAction = useCallback((action: keyof Inputs, value: boolean) => {
    inputs.current[action] = value;
  }, []);

  const resetInputs = useCallback(() => {
    inputs.current = emptyInputs();
    joystickActive.current = false;
    setJoystickPosition({ x: 0, y: 0 });
  }, []);

  const handleJoystickStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    joystickActive.current = true;
    joystickStartPos.current = { x: touch.clientX, y: touch.clientY };
    setJoystickPosition({ x: 0, y: 0 });
  }, []);

  const handleJoystickMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!joystickActive.current) return;
    
    const touch = e.touches[0];
    const dx = touch.clientX - joystickStartPos.current.x;
    const dy = touch.clientY - joystickStartPos.current.y;
    
    const maxDistance = 50;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const clampedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(dy, dx);
    
    const clampedX = Math.cos(angle) * clampedDistance;
    const clampedY = Math.sin(angle) * clampedDistance;
    
    setJoystickPosition({ x: clampedX, y: clampedY });
    
    // Converter para inputs
    const threshold = 15;
    inputs.current.left = clampedX < -threshold;
    inputs.current.right = clampedX > threshold;
    inputs.current.jump = clampedY < -threshold;
    inputs.current.crouch = clampedY > threshold;
  }, []);

  const handleJoystickEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    joystickActive.current = false;
    setJoystickPosition({ x: 0, y: 0 });
    inputs.current.left = false;
    inputs.current.right = false;
    inputs.current.jump = false;
    inputs.current.crouch = false;
  }, []);

  useEffect(() => {
    if (!enabled) {
      resetInputs();
      return;
    }

    return () => {
      resetInputs();
    };
  }, [enabled, resetInputs]);

  return { inputs, setAction, joystickPosition, joystickActive: joystickActive.current, handleJoystickStart, handleJoystickMove, handleJoystickEnd };
}
