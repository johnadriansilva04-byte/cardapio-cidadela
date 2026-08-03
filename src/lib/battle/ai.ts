import { emptyInputs, type BattleState, type Inputs } from "./engine";

/** Simple arcade CPU: closes distance, shoots/punches in range, jumps sometimes, crouches to dodge. */
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

  // Attack AI - shoot or punch based on weapon type and distance
  const useMelee = me.weapon.melee || me.useMelee;
  const attackRange = useMelee ? 120 : 400;

  if (dist < attackRange && Math.sin(t * 5) > 0.2) {
    i.shoot = true;
  }

  // Toggle melee for non-melee weapons when close
  if (!me.weapon.melee && dist < 150 && Math.sin(t * 2) > 0.95) {
    i.melee = true;
  }

  // Jump AI - jump to avoid or close distance
  if (foe.y > 60 && dist < 250 && Math.sin(t * 3.3) > 0.85) i.jump = true;

  // Crouch AI - crouch to dodge incoming shots
  const incomingProjectile = state.projectiles.find(
    (p) => p.ownerId === 1 && p.active && Math.abs(p.x - me.x) < 100,
  );
  if (incomingProjectile && incomingProjectile.y > 50) {
    i.crouch = true;
  }

  return i;
}
