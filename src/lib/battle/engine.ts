export type FighterState = "idle" | "walk" | "jump" | "punch" | "kick" | "hit" | "ko";

export type Inputs = {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
};

export type Fighter = {
  id: 1 | 2;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  state: FighterState;
  stateTimer: number;
  attackCooldown: number;
  hitStun: number;
  combo: number;
  damageDealt: number;
  damageTaken: number;
};

export type BattleState = {
  robot1: Fighter;
  robot2: Fighter;
  round: number;
  timeLeft: number;
  finished: boolean;
  winner: string | null;
  lastEvent: { at: number; text: string } | null;
};

export const ARENA_WIDTH = 900;
export const FIGHTER_WIDTH = 96;
export const GROUND_SPEED = 260;
export const JUMP_VELOCITY = 620;
export const GRAVITY = 1800;
export const PUNCH_RANGE = 120;
export const PUNCH_DAMAGE = 7;
export const JUMP_KICK_DAMAGE = 11;
export const ATTACK_DURATION = 0.22;
export const ATTACK_COOLDOWN = 0.3;
export const HIT_STUN = 0.25;
export const MAX_HP = 100;
export const MAX_ROUNDS = 6;
export const ROUND_TIME = 90;

export const emptyInputs = (): Inputs => ({ left: false, right: false, jump: false, attack: false });

export function createFighter(id: 1 | 2, name: string): Fighter {
  return {
    id,
    name,
    x: id === 1 ? ARENA_WIDTH * 0.3 : ARENA_WIDTH * 0.7,
    y: 0,
    vx: 0,
    vy: 0,
    facing: id === 1 ? 1 : -1,
    hp: MAX_HP,
    state: "idle",
    stateTimer: 0,
    attackCooldown: 0,
    hitStun: 0,
    combo: 0,
    damageDealt: 0,
    damageTaken: 0,
  };
}

export function createBattle(name1: string, name2: string): BattleState {
  return {
    robot1: createFighter(1, name1),
    robot2: createFighter(2, name2),
    round: 1,
    timeLeft: ROUND_TIME,
    finished: false,
    winner: null,
    lastEvent: null,
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function stepFighter(f: Fighter, input: Inputs, dt: number) {
  f.attackCooldown = Math.max(0, f.attackCooldown - dt);
  f.hitStun = Math.max(0, f.hitStun - dt);
  f.stateTimer = Math.max(0, f.stateTimer - dt);

  if (f.state === "ko") return;

  const airborne = f.y > 0;
  const busy =
    f.hitStun > 0 ||
    (f.state === "punch" && f.stateTimer > 0) ||
    (f.state === "kick" && f.stateTimer > 0);

  if (!busy || airborne) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    f.vx = dir * GROUND_SPEED * (airborne ? 0.85 : 1);
  } else {
    f.vx = 0;
  }
  f.x = clamp(f.x + f.vx * dt, FIGHTER_WIDTH / 2, ARENA_WIDTH - FIGHTER_WIDTH / 2);

  if (input.jump && !airborne && !busy) {
    f.vy = JUMP_VELOCITY;
  }
  if (airborne || f.vy > 0) {
    f.vy -= GRAVITY * dt;
    f.y = Math.max(0, f.y + f.vy * dt);
    if (f.y === 0) f.vy = 0;
  }

  if (
    input.attack &&
    f.attackCooldown === 0 &&
    f.hitStun === 0 &&
    f.state !== "punch" &&
    f.state !== "kick"
  ) {
    f.state = f.y > 0 ? "kick" : "punch";
    f.stateTimer = ATTACK_DURATION;
    f.attackCooldown = ATTACK_DURATION + ATTACK_COOLDOWN;
    return;
  }

  if (f.stateTimer > 0 && (f.state === "punch" || f.state === "kick" || f.state === "hit")) return;
  if (f.hitStun > 0) {
    f.state = "hit";
    return;
  }
  if (f.y > 0) f.state = "jump";
  else if (Math.abs(f.vx) > 1) f.state = "walk";
  else f.state = "idle";
}

function resolveHit(attacker: Fighter, defender: Fighter, state: BattleState, now: number) {
  const active = (attacker.state === "punch" || attacker.state === "kick") && attacker.stateTimer > 0;
  if (!active || attacker.stateTimer > ATTACK_DURATION - 0.02) return;
  if (defender.state === "ko" || defender.hitStun > 0) return;

  const dx = defender.x - attacker.x;
  const inFront = Math.sign(dx) === attacker.facing || Math.abs(dx) < 20;
  const inRange = Math.abs(dx) <= PUNCH_RANGE && Math.abs(defender.y - attacker.y) < 130;
  if (!inFront || !inRange) return;

  const damage = attacker.state === "kick" ? JUMP_KICK_DAMAGE : PUNCH_DAMAGE;
  defender.hp = Math.max(0, defender.hp - damage);
  defender.hitStun = HIT_STUN;
  defender.state = "hit";
  defender.stateTimer = HIT_STUN;
  defender.x = clamp(defender.x + attacker.facing * 34, FIGHTER_WIDTH / 2, ARENA_WIDTH - FIGHTER_WIDTH / 2);
  defender.damageTaken += damage;
  defender.combo = 0;
  attacker.damageDealt += damage;
  attacker.combo += 1;
  attacker.stateTimer = 0.05;
  state.lastEvent = {
    at: now,
    text:
      attacker.combo > 1
        ? `${attacker.name} ${attacker.combo}x COMBO! -${damage}`
        : `${attacker.name} ${attacker.state === "kick" ? "VOA-CHUTE" : "SOCO"} -${damage}`,
  };
}

export function stepBattle(
  prev: BattleState,
  i1: Inputs,
  i2: Inputs,
  dt: number,
  now: number,
): BattleState {
  if (prev.finished) return prev;
  const s: BattleState = {
    ...prev,
    robot1: { ...prev.robot1 },
    robot2: { ...prev.robot2 },
  };
  const a = s.robot1;
  const b = s.robot2;

  a.facing = b.x >= a.x ? 1 : -1;
  b.facing = a.x > b.x ? 1 : -1;

  stepFighter(a, i1, dt);
  stepFighter(b, i2, dt);

  const overlap = FIGHTER_WIDTH * 0.7 - Math.abs(a.x - b.x);
  if (overlap > 0 && Math.abs(a.y - b.y) < 100) {
    const push = (overlap / 2) * Math.sign(a.x - b.x || 1);
    a.x = clamp(a.x + push, FIGHTER_WIDTH / 2, ARENA_WIDTH - FIGHTER_WIDTH / 2);
    b.x = clamp(b.x - push, FIGHTER_WIDTH / 2, ARENA_WIDTH - FIGHTER_WIDTH / 2);
  }

  resolveHit(a, b, s, now);
  resolveHit(b, a, s, now);

  s.timeLeft = Math.max(0, s.timeLeft - dt);

  if (a.hp === 0 || b.hp === 0 || s.timeLeft === 0) {
    if (a.hp === 0 && b.hp === 0) s.winner = null;
    else if (a.hp === 0) s.winner = b.name;
    else if (b.hp === 0) s.winner = a.name;
    else s.winner = a.hp === b.hp ? null : a.hp > b.hp ? a.name : b.name;
    if (a.hp === 0) a.state = "ko";
    if (b.hp === 0) b.state = "ko";
    s.finished = true;
  }
  return s;
}

export type FighterSnapshot = Pick<
  Fighter,
  "x" | "y" | "hp" | "facing" | "state" | "combo" | "damageDealt" | "damageTaken"
>;

export const snapshot = (f: Fighter): FighterSnapshot => ({
  x: f.x,
  y: f.y,
  hp: f.hp,
  facing: f.facing,
  state: f.state,
  combo: f.combo,
  damageDealt: f.damageDealt,
  damageTaken: f.damageTaken,
});
