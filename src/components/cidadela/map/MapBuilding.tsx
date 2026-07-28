import { type ReactNode } from "react";

export type Era = "war" | "modern" | "future";

const tone: Record<
  Era,
  { border: string; text: string; shadow: string; roof: string; body: string }
> = {
  war: {
    border: "border-war-dust/45",
    text: "text-war-dust",
    shadow: "shadow-[var(--shadow-dust)]",
    body: "bg-[color-mix(in_oklab,var(--war-deep)_92%,black)]",
    roof: "color-mix(in oklab, var(--war-dust) 72%, transparent)",
  },
  modern: {
    border: "border-modern-glow/45",
    text: "text-modern-glow",
    shadow: "shadow-[var(--shadow-ember)]",
    body: "bg-[color-mix(in_oklab,var(--modern-deep)_92%,black)]",
    roof: "color-mix(in oklab, var(--modern-glow) 72%, transparent)",
  },
  future: {
    border: "border-neon/55",
    text: "text-neon",
    shadow: "shadow-[var(--shadow-neon)]",
    body: "bg-[color-mix(in_oklab,var(--future-deep)_92%,black)]",
    roof: "color-mix(in oklab, var(--neon) 78%, transparent)",
  },
};

interface MapBuildingProps {
  title: string;
  era: Era;
  icon: ReactNode;
  href?: string;
  /** posição no mundo, em % do mapa */
  top: string;
  left: string;
  onClick?: () => void;
}

/** Casinha isométrica pequena, fincada no chão do mapa. */
export function MapBuilding({
  title,
  era,
  icon,
  href = "#",
  top,
  left,
  onClick,
}: MapBuildingProps) {
  const t = tone[era];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ top, left }}
      className={`group absolute z-20 -translate-x-1/2 -translate-y-full focus:outline-none ${t.text}`}
    >
      {/* base isométrica (losango) */}
      <span
        aria-hidden
        className="absolute bottom-[-16px] left-1/2 -z-10 h-16 w-16 rounded-[4px] border border-current/25 bg-current/10 transition-all duration-300 group-hover:border-current/60"
        style={{ transform: "translateX(-50%) rotateX(60deg) rotateZ(45deg)" }}
      />
      <span
        className="block transition-transform duration-300 group-hover:-translate-y-1"
        style={{ animation: "floatY 8s ease-in-out infinite" }}
      >
        {/* telhado */}
        <span
          aria-hidden
          className="mx-auto block h-0 w-0"
          style={{
            borderLeft: "1.85rem solid transparent",
            borderRight: "1.85rem solid transparent",
            borderBottom: `0.85rem solid ${t.roof}`,
          }}
        />
        {/* corpo */}
        <span
          className={`flex h-9 w-[3.7rem] items-center justify-center rounded-b-[4px] border ${t.border} ${t.shadow} ${t.body} backdrop-blur-[2px]`}
        >
          {icon}
        </span>
      </span>
      {/* placa */}
      <span
        className={`mt-2 block w-max max-w-[8rem] rounded-sm border ${t.border} ${t.body} px-2 py-[2px] text-center font-body text-[0.6rem] font-semibold tracking-[0.18em] uppercase backdrop-blur-[2px]`}
      >
        {title}
      </span>
    </button>
  );
}
