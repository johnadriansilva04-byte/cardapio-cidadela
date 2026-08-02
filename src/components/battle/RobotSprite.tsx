import type { Fighter } from "@/lib/battle/engine";

type Props = { fighter: Fighter; palette: "p1" | "p2" };

/** CSS-built arcade mech. Reacts to state: walk, jump, punch, kick, hit, KO. */
export function RobotSprite({ fighter, palette }: Props) {
  const color = palette === "p1" ? "var(--p1)" : "var(--p2)";
  const glow = palette === "p1" ? "var(--glow-p1)" : "var(--glow-p2)";
  const attacking = fighter.state === "punch" || fighter.state === "kick";
  const hurt = fighter.state === "hit";
  const ko = fighter.state === "ko";
  const walking = fighter.state === "walk";

  return (
    <div
      className="relative h-[150px] w-[96px] origin-bottom transition-transform duration-75"
      style={{
        transform: `scaleX(${fighter.facing}) ${ko ? "rotate(-78deg) translateY(14px)" : hurt ? "translateX(-6px) rotate(-6deg)" : ""}`,
        filter: hurt ? "brightness(2.2) saturate(0.3)" : undefined,
      }}
    >
      {/* head */}
      <div
        className="absolute left-1/2 top-0 h-9 w-12 -translate-x-1/2 rounded-sm border"
        style={{ background: "var(--card)", borderColor: color, boxShadow: glow }}
      >
        <div className="absolute left-1.5 top-3 h-2 w-8" style={{ background: color, boxShadow: glow }} />
      </div>
      {/* torso */}
      <div
        className="absolute left-1/2 top-9 h-14 w-16 -translate-x-1/2 rounded-sm border"
        style={{
          background: "linear-gradient(180deg, var(--card), var(--secondary))",
          borderColor: color,
          boxShadow: glow,
        }}
      >
        <div
          className="absolute left-1/2 top-4 h-4 w-4 -translate-x-1/2 rotate-45"
          style={{ background: color, opacity: attacking ? 1 : 0.6 }}
        />
      </div>
      {/* rear arm */}
      <div
        className="absolute top-11 h-3.5 rounded-sm"
        style={{ background: color, opacity: 0.55, left: 8, width: 22 }}
      />
      {/* striking arm */}
      <div
        className="absolute top-12 h-4 rounded-sm transition-all duration-75"
        style={{
          background: color,
          boxShadow: glow,
          left: 44,
          width: fighter.state === "punch" ? 56 : 24,
        }}
      />
      {/* legs */}
      <div
        className="absolute bottom-0 h-11 w-5 origin-top rounded-sm transition-transform duration-100"
        style={{
          background: color,
          left: 28,
          opacity: 0.85,
          transform: `rotate(${walking ? 18 : fighter.y > 0 ? 26 : 0}deg)`,
        }}
      />
      <div
        className="absolute bottom-0 h-11 w-5 origin-top rounded-sm transition-transform duration-100"
        style={{
          background: color,
          left: 48,
          transform: `rotate(${fighter.state === "kick" ? -72 : walking ? -18 : 0}deg)`,
          boxShadow: fighter.state === "kick" ? glow : undefined,
        }}
      />
      {/* impact flash */}
      {attacking && (
        <div
          className="absolute top-8 h-8 w-8 rounded-full"
          style={{ left: fighter.state === "kick" ? 74 : 92, background: color, filter: "blur(6px)" }}
        />
      )}
    </div>
  );
}
