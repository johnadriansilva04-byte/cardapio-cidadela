import { emptyInputs, type BattleState, type Inputs } from "./engine";

/** Simple arcade CPU: closes distance, punches in range, jumps sometimes. */
export function cpuInputs(state: BattleState, t: number): Inputs {
  const me = state.robot2;
  const foe = state.robot1;
  const i = emptyInputs();
  if (state.finished || me.state === "ko") return i;

  const dx = foe.x - me.x;
  const dist = Math.abs(dx);

  if (dist > 110) {
    if (dx > 0) i.right = true;
    else i.left = true;
  } else if (dist < 70) {
    if (dx > 0) i.left = true;
    else i.right = true;
  }

  if (dist < 118 && Math.sin(t * 7) > 0.1) i.attack = true;
  if (foe.y > 60 && dist < 200 && Math.sin(t * 3.3) > 0.85) i.jump = true;
  return i;
}
