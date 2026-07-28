import { type Figure } from "@/lib/iq/generator";

let patternIdCounter = 0;

export function FigureSVG({ figure, className }: { figure: Figure | null; className?: string }) {
  if (!figure) {
    return <div className={className} />;
  }

  const fig = figure; // Local non-null reference
  const sizeMap = { small: 0.6, medium: 0.8, large: 1 };
  const colorMap = {
    red: "#ef4444",
    blue: "#3b82f6",
    green: "#22c55e",
    yellow: "#eab308",
    purple: "#a855f7",
    orange: "#f97316",
    pink: "#ec4899",
    cyan: "#06b6d4",
  };

  const scale = sizeMap[fig.size];
  const color = colorMap[fig.color];

  // Generate unique pattern IDs to avoid collisions
  const hatchId = `hatch-${patternIdCounter++}`;
  const dotId = `dot-${patternIdCounter++}`;

  function renderShape() {
    const strokeWidth = fig.fill === "outline" ? 2.5 : fig.fill === "hatched" ? 1.5 : 0;
    const fill =
      fig.fill === "solid"
        ? color
        : fig.fill === "hatched"
          ? color
          : fig.fill === "dotted"
            ? color
            : "none";
    const fillOpacity = fig.fill === "hatched" || fig.fill === "dotted" ? 0.3 : 1;

    const commonProps = {
      fill,
      fillOpacity,
      stroke: color,
      strokeWidth,
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
    };

    switch (fig.shape) {
      case "circle":
        return <circle cx="50" cy="50" r={38 * scale} {...commonProps} />;
      case "square":
        return (
          <rect
            x={50 - 33 * scale}
            y={50 - 33 * scale}
            width={66 * scale}
            height={66 * scale}
            rx={4}
            {...commonProps}
          />
        );
      case "triangle":
        return (
          <polygon
            points={`50,${12 * scale} ${88 * scale},${88 * scale} ${12 * scale},${88 * scale}`}
            {...commonProps}
          />
        );
      case "diamond":
        return (
          <polygon
            points={`50,${12 * scale} ${88 * scale},50 50,${88 * scale} ${12 * scale},50`}
            {...commonProps}
          />
        );
      case "pentagon":
        const pentagonPoints = Array.from({ length: 5 }, (_, i) => {
          const angle = (i * 72 - 90) * (Math.PI / 180);
          const r = 38 * scale;
          return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
        }).join(" ");
        return <polygon points={pentagonPoints} {...commonProps} />;
      case "star":
        const starPoints = Array.from({ length: 10 }, (_, i) => {
          const angle = (i * 36 - 90) * (Math.PI / 180);
          const r = i % 2 === 0 ? 38 * scale : 18 * scale;
          return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
        }).join(" ");
        return <polygon points={starPoints} {...commonProps} />;
    }
  }

  function renderPatterns() {
    return (
      <defs>
        {fig.fill === "hatched" && (
          <pattern
            id={hatchId}
            patternUnits="userSpaceOnUse"
            width="8"
            height="8"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke={color} strokeWidth="1.5" />
          </pattern>
        )}
        {fig.fill === "dotted" && (
          <pattern id={dotId} patternUnits="userSpaceOnUse" width="8" height="8">
            <circle cx="4" cy="4" r="1.5" fill={color} />
          </pattern>
        )}
      </defs>
    );
  }

  function getFillUrl() {
    if (fig.fill === "hatched") return `url(#${hatchId})`;
    if (fig.fill === "dotted") return `url(#${dotId})`;
    return color;
  }

  return (
    <svg viewBox="0 0 100 100" className={className}>
      {renderPatterns()}
      <g transform={`rotate(${fig.rotation} 50 50)`}>{renderShape()}</g>
      {fig.innerFigure && (
        <g transform="translate(50, 50) scale(0.35) translate(-50, -50)">
          <FigureSVG figure={fig.innerFigure} />
        </g>
      )}
    </svg>
  );
}
