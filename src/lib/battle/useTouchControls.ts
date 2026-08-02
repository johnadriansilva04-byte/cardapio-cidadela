import { useRef, useCallback, useState } from "react";
import { emptyInputs, type Inputs } from "./engine";

export function useTouchControls(enabled: boolean) {
  const inputs = useRef<Inputs>(emptyInputs());
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });

  const setAction = useCallback((action: keyof Inputs, value: boolean) => {
    inputs.current[action] = value;
  }, []);

  const resetJoystick = useCallback(() => {
    setJoystickPosition({ x: 0, y: 0 });
    inputs.current.left = false;
    inputs.current.right = false;
    inputs.current.jump = false;
    inputs.current.crouch = false;
  }, []);

  const handleJoystickStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    
    const maxDistance = 50;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const clampedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(dy, dx);
    
    const clampedX = Math.cos(angle) * clampedDistance;
    const clampedY = Math.sin(angle) * clampedDistance;
    
    setJoystickPosition({ x: clampedX, y: clampedY });
    
    const threshold = 15;
    inputs.current.left = clampedX < -threshold;
    inputs.current.right = clampedX > threshold;
    inputs.current.jump = clampedY < -threshold;
    inputs.current.crouch = clampedY > threshold;
  }, []);

  const handleJoystickMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    
    const maxDistance = 50;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const clampedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(dy, dx);
    
    const clampedX = Math.cos(angle) * clampedDistance;
    const clampedY = Math.sin(angle) * clampedDistance;
    
    setJoystickPosition({ x: clampedX, y: clampedY });
    
    const threshold = 15;
    inputs.current.left = clampedX < -threshold;
    inputs.current.right = clampedX > threshold;
    inputs.current.jump = clampedY < -threshold;
    inputs.current.crouch = clampedY > threshold;
  }, []);

  const handleJoystickEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    resetJoystick();
  }, [resetJoystick]);

  return { inputs, setAction, joystickPosition, handleJoystickStart, handleJoystickMove, handleJoystickEnd };
}
