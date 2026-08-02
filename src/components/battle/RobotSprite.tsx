import type { Fighter } from "@/lib/battle/engine";

type Props = { fighter: Fighter; palette: "p1" | "p2" };

/** CSS-built arcade mech. Reacts to state: walk, jump, crouch, shoot, hit, KO. Shows weapon based on level. */
export function RobotSprite({ fighter, palette }: Props) {
  const color = palette === "p1" ? "#22c55e" : "#ef4444"; // Verde FEB para P1, vermelho para inimigo
  const glow = palette === "p1" ? "0 0 8px #22c55e" : "0 0 8px #ef4444";
  const shooting = fighter.state === "shoot";
  const hurt = fighter.state === "hit";
  const ko = fighter.state === "ko";
  const walking = fighter.state === "walk";
  const crouching = fighter.isCrouching;
  const jumping = fighter.state === "jump";

  // Weapon display based on type
  const hasWeapon = fighter.weapon.type !== "none";
  const weaponSize = fighter.weapon.type === "shotgun" ? 28 : fighter.weapon.type === "rifle" ? 32 : 20;
  const weaponColor = fighter.weapon.type === "shotgun" ? "#ff6b6b" : fighter.weapon.type === "rifle" ? "#4ecdc4" : "#ffe66d";

  return (
    <div
      className="relative origin-bottom transition-transform duration-75"
      style={{
        height: crouching ? "90px" : "150px",
        width: "96px",
        transform: `scaleX(${fighter.facing}) ${ko ? "rotate(-78deg) translateY(14px)" : hurt ? "translateX(-6px) rotate(-6deg)" : ""}`,
        filter: hurt ? "brightness(2.2) saturate(0.3)" : undefined,
      }}
    >
      {/* head */}
      <div
        className="absolute left-1/2 top-0 h-9 w-12 -translate-x-1/2 rounded-sm border"
        style={{ 
          background: "var(--card)", 
          borderColor: color, 
          boxShadow: glow,
          top: crouching ? "30px" : "0"
        }}
      >
        <div className="absolute left-1.5 top-3 h-2 w-8" style={{ background: color, boxShadow: glow }} />
      </div>
      
      {/* torso */}
      <div
        className="absolute left-1/2 h-14 w-16 -translate-x-1/2 rounded-sm border"
        style={{
          background: "linear-gradient(180deg, var(--card), var(--secondary))",
          borderColor: color,
          boxShadow: glow,
          top: crouching ? "54px" : "36px",
        }}
      >
        <div
          className="absolute left-1/2 top-4 h-4 w-4 -translate-x-1/2 rotate-45"
          style={{ background: color, opacity: shooting ? 1 : 0.6 }}
        />
      </div>
      
      {/* Weapon arm */}
      {hasWeapon && (
        <div
          className="absolute h-4 rounded-sm transition-all duration-75"
          style={{
            background: color,
            boxShadow: glow,
            left: 44,
            top: crouching ? "68px" : "48px",
            width: shooting ? weaponSize + 16 : 24,
          }}
        >
          {/* Weapon */}
          <div
            className="absolute h-3 rounded-sm"
            style={{
              background: weaponColor,
              right: -weaponSize,
              top: 0.5,
              width: weaponSize,
              boxShadow: `0 0 8px ${weaponColor}`,
            }}
          />
        </div>
      )}
      
      {/* Non-weapon arm */}
      {!hasWeapon && (
        <div
          className="absolute h-4 rounded-sm transition-all duration-75"
          style={{
            background: color,
            boxShadow: glow,
            left: 44,
            top: crouching ? "68px" : "48px",
            width: 24,
          }}
        />
      )}
      
      {/* rear arm */}
      <div
        className="absolute h-3.5 rounded-sm"
        style={{ 
          background: color, 
          opacity: 0.55, 
          left: 8, 
          width: 22,
          top: crouching ? "62px" : "47px"
        }}
      />
      
      {/* legs */}
      <div
        className="absolute bottom-0 h-11 w-5 origin-top rounded-sm transition-transform duration-100"
        style={{
          background: color,
          left: 28,
          opacity: 0.85,
          transform: `rotate(${walking ? 18 : jumping ? 26 : crouching ? -45 : 0}deg)`,
          height: crouching ? "20px" : "44px",
        }}
      />
      <div
        className="absolute bottom-0 h-11 w-5 origin-top rounded-sm transition-transform duration-100"
        style={{
          background: color,
          left: 48,
          transform: `rotate(${walking ? -18 : jumping ? 26 : crouching ? -45 : 0}deg)`,
          height: crouching ? "20px" : "44px",
        }}
      />
      
      {/* muzzle flash when shooting */}
      {shooting && hasWeapon && (
        <div
          className="absolute h-6 w-6 rounded-full"
          style={{ 
            left: 92, 
            top: crouching ? "64px" : "44px", 
            background: weaponColor, 
            filter: "blur(4px)",
            opacity: 0.8
          }}
        />
      )}
    </div>
  );
}
