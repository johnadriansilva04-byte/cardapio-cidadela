export type FighterState = "idle" | "walk" | "jump" | "crouch" | "shoot" | "hit" | "ko";

export type Inputs = {
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  shoot: boolean;
};

export type Projectile = {
  id: number;
  ownerId: 1 | 2;
  x: number;
  y: number;
  vx: number;
  damage: number;
  active: boolean;
};

export type WeaponType = "none" | "pistol" | "rifle" | "shotgun";

export type Weapon = {
  type: WeaponType;
  damage: number;
  fireRate: number;
  bulletSpeed: number;
  level: number;
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
  level: number;
  weapon: Weapon;
  isCrouching: boolean;
};

export type BattleState = {
  robot1: Fighter;
  robot2: Fighter;
  projectiles: Projectile[];
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
export const CROUCH_HEIGHT = 40;
export const PROJECTILE_SIZE = 8;
export const HIT_STUN = 0.25;
export const MAX_HP = 100;
export const MAX_ROUNDS = 6;
export const ROUND_TIME = 90;

export const WEAPONS: Record<WeaponType, Weapon> = {
  none: { type: "none", damage: 0, fireRate: 0, bulletSpeed: 0, level: 0 },
  pistol: { type: "pistol", damage: 10, fireRate: 0.5, bulletSpeed: 600, level: 1 }, // Pistola M1911
  rifle: { type: "rifle", damage: 8, fireRate: 0.15, bulletSpeed: 800, level: 3 }, // Garand M1
  shotgun: { type: "shotgun", damage: 15, fireRate: 0.8, bulletSpeed: 500, level: 5 }, // Browning Auto-5
};

export const getWeaponForLevel = (level: number): Weapon => {
  if (level >= 5) return WEAPONS.shotgun;
  if (level >= 3) return WEAPONS.rifle;
  if (level >= 1) return WEAPONS.pistol;
  return WEAPONS.none;
};

export const emptyInputs = (): Inputs => ({ left: false, right: false, jump: false, crouch: false, shoot: false });

export function createFighter(id: 1 | 2, name: string, level: number = 0): Fighter {
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
    level,
    weapon: getWeaponForLevel(level),
    isCrouching: false,
  };
}

export function createBattle(name1: string, name2: string, level1: number = 0, level2: number = 0): BattleState {
  return {
    robot1: createFighter(1, name1, level1),
    robot2: createFighter(2, name2, level2),
    projectiles: [],
    round: 1,
    timeLeft: ROUND_TIME,
    finished: false,
    winner: null,
    lastEvent: null,
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

let projectileIdCounter = 0;

function stepFighter(f: Fighter, input: Inputs, dt: number, state: BattleState, now: number) {
  f.attackCooldown = Math.max(0, f.attackCooldown - dt);
  f.hitStun = Math.max(0, f.hitStun - dt);
  f.stateTimer = Math.max(0, f.stateTimer - dt);

  if (f.state === "ko") return;

  const airborne = f.y > 0;
  const busy = f.hitStun > 0 || (f.state === "shoot" && f.stateTimer > 0);

  // Handle crouching
  f.isCrouching = input.crouch && !airborne && !busy;

  if (!busy || airborne) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    f.vx = dir * GROUND_SPEED * (airborne ? 0.85 : 1) * (f.isCrouching ? 0.5 : 1);
  } else {
    f.vx = 0;
  }
  f.x = clamp(f.x + f.vx * dt, FIGHTER_WIDTH / 2, ARENA_WIDTH - FIGHTER_WIDTH / 2);

  if (input.jump && !airborne && !busy && !f.isCrouching) {
    f.vy = JUMP_VELOCITY;
  }
  if (airborne || f.vy > 0) {
    f.vy -= GRAVITY * dt;
    f.y = Math.max(0, f.y + f.vy * dt);
    if (f.y === 0) f.vy = 0;
  }

  // Handle shooting
  if (
    input.shoot &&
    f.attackCooldown === 0 &&
    f.hitStun === 0 &&
    f.weapon.type !== "none" &&
    f.state !== "shoot"
  ) {
    f.state = "shoot";
    f.stateTimer = 0.15;
    f.attackCooldown = f.weapon.fireRate;
    
    // Create projectile
    const projectile: Projectile = {
      id: projectileIdCounter++,
      ownerId: f.id,
      x: f.x + f.facing * (FIGHTER_WIDTH / 2 + 10),
      y: f.y + (f.isCrouching ? CROUCH_HEIGHT : 60),
      vx: f.facing * f.weapon.bulletSpeed,
      damage: f.weapon.damage,
      active: true,
    };
    state.projectiles.push(projectile);
    
    state.lastEvent = {
      at: now,
      text: `${f.name} TIRO!`,
    };
    return;
  }

  // Update state
  if (f.stateTimer > 0 && (f.state === "shoot" || f.state === "hit")) return;
  if (f.hitStun > 0) {
    f.state = "hit";
    return;
  }
  if (f.isCrouching) f.state = "crouch";
  else if (f.y > 0) f.state = "jump";
  else if (Math.abs(f.vx) > 1) f.state = "walk";
  else f.state = "idle";
}

function resolveProjectileHit(projectile: Projectile, defender: Fighter, state: BattleState, now: number) {
  if (!projectile.active) return;
  if (defender.state === "ko" || defender.hitStun > 0) return;

  // Check if projectile is in range of defender
  const dx = Math.abs(projectile.x - defender.x);
  const dy = Math.abs(projectile.y - defender.y);
  
  // Hitbox size varies by crouching state
  const hitboxHeight = defender.isCrouching ? CROUCH_HEIGHT : 80;
  const hitboxWidth = FIGHTER_WIDTH * 0.8;
  
  if (dx < hitboxWidth && dy < hitboxHeight) {
    // Check if crouching avoids high shots
    if (defender.isCrouching && projectile.y > CROUCH_HEIGHT + 20) {
      // Crouching successfully dodged the shot
      return;
    }
    
    projectile.active = false;
    const damage = projectile.damage;
    defender.hp = Math.max(0, defender.hp - damage);
    defender.hitStun = HIT_STUN;
    defender.state = "hit";
    defender.stateTimer = HIT_STUN;
    defender.damageTaken += damage;
    defender.combo = 0;
    
    // Find attacker and update stats
    const attacker = projectile.ownerId === 1 ? state.robot1 : state.robot2;
    attacker.damageDealt += damage;
    attacker.combo += 1;
    
    state.lastEvent = {
      at: now,
      text:
        attacker.combo > 1
          ? `${attacker.name} ${attacker.combo}x COMBO! -${damage}`
          : `${attacker.name} ACERTOU! -${damage}`,
    };
  }
}

function stepProjectiles(state: BattleState, dt: number) {
  state.projectiles.forEach(p => {
    if (!p.active) return;
    p.x += p.vx * dt;
    
    // Remove projectile if out of bounds
    if (p.x < 0 || p.x > ARENA_WIDTH) {
      p.active = false;
    }
  });
  
  // Clean up inactive projectiles
  state.projectiles = state.projectiles.filter(p => p.active);
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
    projectiles: [...prev.projectiles],
  };
  const a = s.robot1;
  const b = s.robot2;

  a.facing = b.x >= a.x ? 1 : -1;
  b.facing = a.x > b.x ? 1 : -1;

  stepFighter(a, i1, dt, s, now);
  stepFighter(b, i2, dt, s, now);

  const overlap = FIGHTER_WIDTH * 0.7 - Math.abs(a.x - b.x);
  if (overlap > 0 && Math.abs(a.y - b.y) < 100) {
    const push = (overlap / 2) * Math.sign(a.x - b.x || 1);
    a.x = clamp(a.x + push, FIGHTER_WIDTH / 2, ARENA_WIDTH - FIGHTER_WIDTH / 2);
    b.x = clamp(b.x - push, FIGHTER_WIDTH / 2, ARENA_WIDTH - FIGHTER_WIDTH / 2);
  }

  // Step projectiles and check hits
  stepProjectiles(s, dt);
  s.projectiles.forEach(p => {
    if (p.ownerId === 1) resolveProjectileHit(p, b, s, now);
    else resolveProjectileHit(p, a, s, now);
  });

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
  "x" | "y" | "hp" | "facing" | "state" | "combo" | "damageDealt" | "damageTaken" | "level" | "weapon" | "isCrouching"
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
  level: f.level,
  weapon: f.weapon,
  isCrouching: f.isCrouching,
});
