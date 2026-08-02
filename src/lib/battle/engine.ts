export type FighterState = "idle" | "walk" | "jump" | "crouch" | "shoot" | "punch" | "hit" | "ko";

export type Inputs = {
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  shoot: boolean;
  melee: boolean;
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

export type WeaponType = "club" | "pistol" | "rifle" | "shotgun";

export type Weapon = {
  type: WeaponType;
  damage: number;
  fireRate: number;
  bulletSpeed: number;
  level: number;
  melee: boolean;
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
  useMelee: boolean;
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

export const ARENA_WIDTH = 1500;
export const FIGHTER_WIDTH = 60;
export const GROUND_SPEED = 320;
export const JUMP_VELOCITY = 1800;
export const GRAVITY = 2200;
export const CROUCH_HEIGHT = 35;
export const PROJECTILE_SIZE = 6;
export const HIT_STUN = 0.2;
export const MAX_HP = 100;
export const MAX_ROUNDS = 6;
export const ROUND_TIME = 90;
export const MELEE_RANGE = 100;
export const MELEE_DAMAGE_BODY = 6;
export const MELEE_DAMAGE_HEAD = 15;
export const MELEE_DURATION = 0.2;
export const MELEE_COOLDOWN = 0.3;

export const WEAPONS: Record<WeaponType, Weapon> = {
  club: { type: "club", damage: 8, fireRate: 0, bulletSpeed: 0, level: 0, melee: true }, // Bastão de combate
  pistol: { type: "pistol", damage: 10, fireRate: 0.5, bulletSpeed: 1200, level: 1, melee: false }, // Pistola M1911
  rifle: { type: "rifle", damage: 8, fireRate: 0.15, bulletSpeed: 1500, level: 3, melee: false }, // Garand M1
  shotgun: { type: "shotgun", damage: 15, fireRate: 0.8, bulletSpeed: 1000, level: 5, melee: false }, // Browning Auto-5
};

export const getWeaponForLevel = (level: number): Weapon => {
  if (level >= 5) return WEAPONS.shotgun;
  if (level >= 3) return WEAPONS.rifle;
  if (level >= 1) return WEAPONS.pistol;
  return WEAPONS.club;
};

export const emptyInputs = (): Inputs => ({ left: false, right: false, jump: false, crouch: false, shoot: false, melee: false });

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
    useMelee: false,
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

  // Handle shooting/melee based on weapon type and user preference
  const useMeleeAttack = f.weapon.melee || f.useMelee;
  
  if (useMeleeAttack) {
    // Melee attack (punch/club) - ABSOLUTely NO PROJECTILES
    if (
      input.shoot &&
      f.attackCooldown === 0 &&
      f.hitStun === 0 &&
      f.state !== "punch"
    ) {
      f.state = "punch";
      f.stateTimer = MELEE_DURATION;
      f.attackCooldown = MELEE_DURATION + MELEE_COOLDOWN;
      return;
    }
  } else {
    // Ranged attack (shooting) - ONLY CREATE PROJECTILES FOR RANGED WEAPONS AND LEVEL 1+
    if (
      input.shoot &&
      f.attackCooldown === 0 &&
      f.hitStun === 0 &&
      f.state !== "shoot" &&
      f.level >= 1 // Só pode atirar a partir do nível 1
    ) {
      f.state = "shoot";
      f.stateTimer = 0.15;
      f.attackCooldown = f.weapon.fireRate;

      // Create projectile ONLY for ranged weapons (not melee)
      if (f.weapon.bulletSpeed > 0) {
        const projectile: Projectile = {
          id: projectileIdCounter++,
          ownerId: f.id,
          x: f.x + f.facing * (FIGHTER_WIDTH / 2 + 10),
          y: f.y + (f.isCrouching ? CROUCH_HEIGHT : 50),
          vx: f.facing * f.weapon.bulletSpeed,
          damage: f.weapon.damage,
          active: true,
        };
        state.projectiles.push(projectile);
      }

      state.lastEvent = {
        at: now,
        text: `${f.name} TIRO!`,
      };
      return;
    }
  }

  // Toggle melee/ranged with separate key
  if (input.melee && !f.weapon.melee && f.attackCooldown === 0) {
    f.useMelee = !f.useMelee;
    f.attackCooldown = 0.2; // Small cooldown to prevent spam
    state.lastEvent = {
      at: now,
      text: f.useMelee ? `${f.name} SOCOS!` : `${f.name} TIROS!`,
    };
  }

  // Update state
  if (f.stateTimer > 0 && (f.state === "shoot" || f.state === "punch" || f.state === "hit")) return;
  if (f.hitStun > 0) {
    f.state = "hit";
    return;
  }
  if (f.isCrouching) f.state = "crouch";
  else if (f.y > 0) f.state = "jump";
  else if (Math.abs(f.vx) > 1) f.state = "walk";
  else f.state = "idle";
}

function resolveMeleeHit(attacker: Fighter, defender: Fighter, state: BattleState, now: number) {
  const active = attacker.state === "punch" && attacker.stateTimer > 0;
  if (!active || attacker.stateTimer > MELEE_DURATION - 0.02) return;
  if (defender.state === "ko" || defender.hitStun > 0) return;

  const dx = defender.x - attacker.x;
  const inFront = Math.sign(dx) === attacker.facing || Math.abs(dx) < 30;
  const inRange = Math.abs(dx) <= MELEE_RANGE && Math.abs(defender.y - attacker.y) < 120;
  if (!inFront || !inRange) return;

  // Check if hit is on head or body based on height difference
  const isHeadHit = defender.y < 25 && Math.abs(defender.y - attacker.y) > 15;
  const damage = attacker.weapon.type === "club" 
    ? attacker.weapon.damage + (isHeadHit ? 4 : 0)
    : isHeadHit ? MELEE_DAMAGE_HEAD : MELEE_DAMAGE_BODY;
  
  defender.hp = Math.max(0, defender.hp - damage);
  defender.hitStun = HIT_STUN;
  defender.state = "hit";
  defender.stateTimer = HIT_STUN;
  defender.x = clamp(defender.x + attacker.facing * 20, FIGHTER_WIDTH / 2, ARENA_WIDTH - FIGHTER_WIDTH / 2);
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
        : `${attacker.name} ${attacker.weapon.type === "club" ? "BASTÃO!" : isHeadHit ? "NA CABEÇA!" : "SOCO!"} -${damage}`,
  };
}

function resolveProjectileHit(projectile: Projectile, defender: Fighter, state: BattleState, now: number) {
  if (!projectile.active) return;
  if (defender.state === "ko" || defender.hitStun > 0) return;

  // Check if projectile is in range of defender
  const dx = Math.abs(projectile.x - defender.x);
  const dy = Math.abs(projectile.y - defender.y);
  
  // Hitbox size varies by crouching state
  const hitboxHeight = defender.isCrouching ? CROUCH_HEIGHT : 60;
  const hitboxWidth = FIGHTER_WIDTH * 0.7;
  
  if (dx < hitboxWidth && dy < hitboxHeight) {
    // Check if crouching avoids high shots
    if (defender.isCrouching && projectile.y > CROUCH_HEIGHT + 15) {
      // Crouching successfully dodged the shot
      return;
    }
    
    // Check if jumping over projectile
    if (defender.y > 30 && projectile.y < 20) {
      // Jumping over projectile
      return;
    }
    
    // Check if head shot for extra damage
    const isHeadShot = defender.y < 25 && projectile.y < 35;
    const damage = isHeadShot ? projectile.damage + 3 : projectile.damage;
    
    projectile.active = false;
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
          : `${attacker.name} ${isHeadShot ? "NA CABEÇA!" : "ACERTOU!"} -${damage}`,
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

  const overlap = FIGHTER_WIDTH * 0.4 - Math.abs(a.x - b.x);
  // Only push if NOT jumping over (allow jumping over opponent)
  if (overlap > 0 && Math.abs(a.y - b.y) < 50) {
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

  // Check melee hits
  resolveMeleeHit(a, b, s, now);
  resolveMeleeHit(b, a, s, now);

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
  "x" | "y" | "hp" | "facing" | "state" | "combo" | "damageDealt" | "damageTaken" | "level" | "weapon" | "isCrouching" | "useMelee"
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
  useMelee: f.useMelee,
});
