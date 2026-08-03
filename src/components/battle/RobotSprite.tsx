import type { Fighter } from "@/lib/battle/engine";

type Props = { fighter: Fighter; palette: "p1" | "p2" };

/** CSS-built arcade mech. Reacts to state: walk, jump, crouch, shoot, punch, hit, KO. Shows weapon based on level. */
export function RobotSprite({ fighter, palette }: Props) {
  const color = palette === "p1" ? "#22c55e" : "#ef4444"; // Verde FEB para P1, vermelho para inimigo
  const glow = palette === "p1" ? "0 0 8px #22c55e" : "0 0 8px #ef4444";
  const shooting = fighter.state === "shoot";
  const punching = fighter.state === "punch";
  const hurt = fighter.state === "hit";
  const ko = fighter.state === "ko";
  const walking = fighter.state === "walk";
  const crouching = fighter.isCrouching;
  const jumping = fighter.state === "jump";

  // Weapon display based on type
  const hasWeapon = fighter.weapon.type !== undefined && fighter.weapon.type !== null;
  const weaponSize =
    fighter.weapon.type === "shotgun"
      ? 28
      : fighter.weapon.type === "rifle"
        ? 32
        : fighter.weapon.type === "club"
          ? 24
          : 20;
  const weaponColor =
    fighter.weapon.type === "shotgun"
      ? "#ff6b6b"
      : fighter.weapon.type === "rifle"
        ? "#4ecdc4"
        : fighter.weapon.type === "club"
          ? "#8b4513"
          : "#ffe66d";

  return (
    <div
      className="relative origin-bottom transition-transform duration-75"
      style={{
        height: crouching ? "50px" : "85px",
        width: "55px",
        transform: `scaleX(${fighter.facing}) ${ko ? "rotate(-78deg) translateY(14px)" : ""}`,
      }}
    >
      {/* head */}
      <div
        className="absolute left-1/2 top-0 h-6 w-7 -translate-x-1/2 rounded-sm border"
        style={{
          background: "var(--card)",
          borderColor: color,
          boxShadow: glow,
          top: crouching ? "18px" : "0",
        }}
      >
        <div
          className="absolute left-1 top-1.5 h-1 w-5"
          style={{ background: color, boxShadow: glow }}
        />
      </div>

      {/* torso */}
      <div
        className="absolute left-1/2 h-8 w-9 -translate-x-1/2 rounded-sm border"
        style={{
          background: "linear-gradient(180deg, var(--card), var(--secondary))",
          borderColor: color,
          boxShadow: glow,
          top: crouching ? "32px" : "22px",
        }}
      >
        <div
          className="absolute left-1/2 top-1.5 h-1.5 w-1.5 -translate-x-1/2 rotate-45"
          style={{ background: color, opacity: shooting || punching ? 1 : 0.6 }}
        />
      </div>

      {/* Weapon/Melee arm */}
      {hasWeapon && !fighter.useMelee ? (
        <div
          className="absolute h-3 rounded-sm transition-all duration-75"
          style={{
            background: color,
            boxShadow: glow,
            left: 18,
            top: crouching ? "28px" : "20px",
            width: shooting ? weaponSize + 4 : 14,
          }}
        >
          {/* Weapon */}
          <div
            className="absolute h-1.5 rounded-sm"
            style={{
              background: weaponColor,
              right: -weaponSize,
              top: 0.5,
              width: weaponSize,
              boxShadow: `0 0 4px ${weaponColor}`,
            }}
          />
        </div>
      ) : (
        <div
          className="absolute h-3 rounded-sm transition-all duration-75"
          style={{
            background: color,
            boxShadow: glow,
            left: 18,
            top: crouching ? "32px" : "24px",
            width: punching ? 90 : 14,
          }}
        >
          {/* Club for melee */}
          {fighter.weapon.type === "club" && (
            <div
              className="absolute h-2.5 rounded-sm"
              style={{
                background: weaponColor,
                right: -20,
                top: -0.5,
                width: 20,
                boxShadow: `0 0 4px ${weaponColor}`,
              }}
            />
          )}
        </div>
      )}

      {/* rear arm */}
      <div
        className="absolute h-2 rounded-sm"
        style={{
          background: color,
          opacity: 0.55,
          left: 2,
          width: 14,
          top: crouching ? "30px" : "22px",
        }}
      />

      {/* legs */}
      <div
        className="absolute bottom-0 h-6 w-2 origin-top rounded-sm transition-transform duration-100"
        style={{
          background: color,
          left: 17,
          opacity: 0.85,
          transform: `rotate(${walking ? 18 : jumping ? 26 : crouching ? -45 : 0}deg)`,
          height: crouching ? "12px" : "28px",
        }}
      />
      <div
        className="absolute bottom-0 h-6 w-2 origin-top rounded-sm transition-transform duration-100"
        style={{
          background: color,
          left: 27,
          transform: `rotate(${walking ? -18 : jumping ? 26 : crouching ? -45 : 0}deg)`,
          height: crouching ? "12px" : "28px",
        }}
      />

      {/* jet fire effect when jumping */}
      {jumping && (
        <>
          <div
            className="absolute bottom-0 h-4 w-3 rounded-full animate-pulse"
            style={{
              left: 18,
              background: "linear-gradient(to bottom, #ff6600, #ffcc00, transparent)",
              boxShadow: "0 0 8px #ff6600, 0 0 16px #ffcc00",
              filter: "blur(1px)",
            }}
          />
          <div
            className="absolute bottom-0 h-4 w-3 rounded-full animate-pulse"
            style={{
              left: 25,
              background: "linear-gradient(to bottom, #ff6600, #ffcc00, transparent)",
              boxShadow: "0 0 8px #ff6600, 0 0 16px #ffcc00",
              filter: "blur(1px)",
            }}
          />
        </>
      )}

      {/* muzzle flash when shooting ONLY */}
      {shooting && hasWeapon && !fighter.useMelee && (
        <div
          className="absolute h-3 w-3 rounded-full"
          style={{
            left: 50,
            top: crouching ? "34px" : "22px",
            background: weaponColor,
            filter: "blur(2px)",
            opacity: 0.8,
          }}
        />
      )}
    </div>
  );
}
