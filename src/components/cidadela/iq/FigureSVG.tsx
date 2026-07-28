import { type Figure } from "@/lib/iq/generator";

export function FigureSVG({ figure, className }: { figure: Figure | null; className?: string }) {
  if (!figure) {
    return <div className={className} />;
  }

  const sizeMap = { small: 0.6, medium: 0.8, large: 1 };
  const colorMap = {
    red: "#ef4444",
    blue: "#3b82f6",
    green: "#22c55e",
    yellow: "#eab308",
    purple: "#a855f7",
    orange: "#f97316",
  };

  const scale = sizeMap[figure.size];
  const color = colorMap[figure.color];

  function renderShape() {
    const commonProps = {
      fill: figure.fill === "solid" ? color : "none",
      stroke: color,
      strokeWidth: figure.fill === "outline" ? 2 : figure.fill === "hatched" ? 1 : 0,
      transform: `rotate(${figure.rotation})`,
      transformOrigin: "center",
    };

    switch (figure.shape) {
      case "circle":
        return <circle cx="50" cy="50" r={40 * scale} {...commonProps} />;
      case "square":
        return (
          <rect
            x={50 - 35 * scale}
            y={50 - 35 * scale}
            width={70 * scale}
            height={70 * scale}
            {...commonProps}
          />
        );
      case "triangle":
        return (
          <polygon
            points={`50,${10 * scale} ${90 * scale},${90 * scale} ${10 * scale},${90 * scale}`}
            {...commonProps}
          />
        );
      case "diamond":
        return (
          <polygon
            points={`50,${10 * scale} ${90 * scale},50 50,${90 * scale} ${10 * scale},50`}
            {...commonProps}
          />
        );
      case "pentagon":
        const pentagonPoints = Array.from({ length: 5 }, (_, i) => {
          const angle = (i * 72 - 90) * (Math.PI / 180);
          const r = 40 * scale;
          return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
        }).join(" ");
        return <polygon points={pentagonPoints} {...commonProps} />;
      case "star":
        const starPoints = Array.from({ length: 10 }, (_, i) => {
          const angle = (i * 36 - 90) * (Math.PI / 180);
          const r = i % 2 === 0 ? 40 * scale : 20 * scale;
          return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
        }).join(" ");
        return <polygon points={starPoints} {...commonProps} />;
    }
  }

  function renderHatching() {
    if (figure.fill !== "hatched") return null;
    return (
      <pattern
        id={`hatch-${figure.shape}-${figure.size}`}
        patternUnits="userSpaceOnUse"
        width="8"
        height="8"
      >
        <line x1="0" y1="0" x2="8" y2="8" stroke={color} strokeWidth="1" />
      </pattern>
    );
  }

  function renderDotted() {
    if (figure.fill !== "dotted") return null;
    return (
      <pattern
        id={`dot-${figure.shape}-${figure.size}`}
        patternUnits="userSpaceOnUse"
        width="6"
        height="6"
      >
        <circle cx="3" cy="3" r="1" fill={color} />
      </pattern>
    );
  }

  return (
    <svg viewBox="0 0 100 100" className={className}>
      <defs>
        {renderHatching()}
        {renderDotted()}
      </defs>
      <g transform={`rotate(${figure.rotation} 50 50)`}>
        {figure.fill === "hatched" && (
          <g>
            {renderShape()}
            <rect
              x={50 - 35 * scale}
              y={50 - 35 * scale}
              width={70 * scale}
              height={70 * scale}
              fill={`url(#hatch-${figure.shape}-${figure.size})`}
              opacity={0.3}
            />
          </g>
        )}
        {figure.fill === "dotted" && (
          <g>
            {renderShape()}
            <rect
              x={50 - 35 * scale}
              y={50 - 35 * scale}
              width={70 * scale}
              height={70 * scale}
              fill={`url(#dot-${figure.shape}-${figure.size})`}
              opacity={0.3}
            />
          </g>
        )}
        {figure.fill !== "hatched" && figure.fill !== "dotted" && renderShape()}
      </g>
      {figure.innerFigure && (
        <g transform="translate(50, 50) scale(0.4) translate(-50, -50)">
          <FigureSVG figure={figure.innerFigure} />
        </g>
      )}
    </svg>
  );
}
