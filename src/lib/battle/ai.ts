import { emptyInputs, type BattleState, type Inputs } from "./engine";

/** Simple arcade CPU: closes distance, shoots in range, jumps sometimes, crouches to dodge. */
export function cpuInputs(state: BattleState, t: number): Inputs {
  const me = state.robot2;
  const foe = state.robot1;
  const i = emptyInputs();
  if (state.finished || me.state === "ko") return i;

  const dx = foe.x - me.x;
  const dist = Math.abs(dx);

  // Movement AI
  if (dist > 200) {
    if (dx > 0) i.right = true;
    else i.left = true;
  } else if (dist < 100) {
    if (dx > 0) i.left = true;
    else i.right = true;
  }

  // Shooting AI - shoot when in range and has weapon
  if (me.weapon.type !== "none" && dist < 400 && Math.sin(t * 5) > 0.2) {
    i.shoot = true;
  }

  // Jump AI - jump to avoid or close distance
  if (foe.y > 60 && dist < 250 && Math.sin(t * 3.3) > 0.85) i.jump = true;

  // Crouch AI - crouch to dodge incoming shots
  const incomingProjectile = state.projectiles.find(
    p => p.ownerId === 1 && p.active && Math.abs(p.x - me.x) < 100
  );
  if (incomingProjectile && incomingProjectile.y > 50) {
    i.crouch = true;
  }

  return i;
}
