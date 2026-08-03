import { hashSeed } from "./rng";

export type Figure = {
  shape: "circle" | "square" | "triangle" | "diamond" | "pentagon" | "star";
  size: "small" | "medium" | "large";
  color: "red" | "blue" | "green" | "yellow" | "purple" | "orange" | "pink" | "cyan";
  rotation: 0 | 30 | 45 | 60 | 90 | 120 | 135 | 150 | 180 | 210 | 225 | 240 | 270 | 300 | 315 | 330;
  fill: "solid" | "outline" | "hatched" | "dotted";
  innerFigure?: Figure;
};

export type MatrixItem = {
  id: string;
  cells: (Figure | null)[];
  options: Figure[];
  answerIndex: number;
  difficulty: number;
  rules: { description: string; type: string }[];
};

const SHAPES: Figure["shape"][] = ["circle", "square", "triangle", "diamond", "pentagon", "star"];
const SIZES: Figure["size"][] = ["small", "medium", "large"];
const COLORS: Figure["color"][] = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
  "pink",
  "cyan",
];
const ROTATIONS: Figure["rotation"][] = [
  0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330,
];
const FILLS: Figure["fill"][] = ["solid", "outline", "hatched", "dotted"];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function generateFigure(rng: () => number, depth = 0): Figure {
  if (depth > 2) {
    return {
      shape: pick(SHAPES, rng),
      size: pick(SIZES, rng),
      color: pick(COLORS, rng),
      rotation: pick(ROTATIONS, rng),
      fill: pick(FILLS, rng),
    };
  }

  const figure: Figure = {
    shape: pick(SHAPES, rng),
    size: pick(SIZES, rng),
    color: pick(COLORS, rng),
    rotation: pick(ROTATIONS, rng),
    fill: pick(FILLS, rng),
  };

  if (rng() > 0.7) {
    figure.innerFigure = generateFigure(rng, depth + 1);
  }

  return figure;
}

function cloneFigure(fig: Figure): Figure {
  return {
    ...fig,
    innerFigure: fig.innerFigure ? cloneFigure(fig.innerFigure) : undefined,
  };
}

function applyRule(fig: Figure, rule: string, rng: () => number): Figure {
  const cloned = cloneFigure(fig);
  switch (rule) {
    case "shape_cycle": {
      const shapeIdx = SHAPES.indexOf(cloned.shape);
      cloned.shape = SHAPES[(shapeIdx + 1) % SHAPES.length];
      break;
    }
    case "size_grow": {
      const sizeIdx = SIZES.indexOf(cloned.size);
      cloned.size = SIZES[Math.min(sizeIdx + 1, SIZES.length - 1)];
      break;
    }
    case "color_cycle": {
      const colorIdx = COLORS.indexOf(cloned.color);
      cloned.color = COLORS[(colorIdx + 1) % COLORS.length];
      break;
    }
    case "rotate_45":
      cloned.rotation = ((cloned.rotation + 45) % 360) as Figure["rotation"];
      break;
    case "fill_cycle": {
      const fillIdx = FILLS.indexOf(cloned.fill);
      cloned.fill = FILLS[(fillIdx + 1) % FILLS.length];
      break;
    }
    case "add_inner":
      if (!cloned.innerFigure && rng() > 0.5) {
        cloned.innerFigure = generateFigure(rng, 2);
      }
      break;
    case "remove_inner":
      cloned.innerFigure = undefined;
      break;
  }
  return cloned;
}

export function buildTest(seed: number, itemCount: number): { seed: number; items: MatrixItem[] } {
  const rng = seededRandom(seed);
  const items: MatrixItem[] = [];

  for (let i = 0; i < itemCount; i++) {
    const rules: { description: string; type: string }[] = [];
    const ruleTypes = [
      "shape_cycle",
      "size_grow",
      "color_cycle",
      "rotate_45",
      "fill_cycle",
      "add_inner",
      "remove_inner",
    ];
    const selectedRules = ruleTypes.sort(() => rng() - 0.5).slice(0, 2 + Math.floor(rng() * 2));

    selectedRules.forEach((rule) => {
      const descriptions: Record<string, string> = {
        shape_cycle: "Forma muda ciclicamente",
        size_grow: "Tamanho cresce",
        color_cycle: "Cor muda ciclicamente",
        rotate_45: "Rotação de 45 graus",
        fill_cycle: "Preenchimento muda ciclicamente",
        add_inner: "Figura interna adicionada",
        remove_inner: "Figura interna removida",
      };
      rules.push({ description: descriptions[rule], type: rule });
    });

    const baseFigure = generateFigure(rng);
    const cells: (Figure | null)[] = [];

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (row === 2 && col === 2) {
          cells.push(null);
          continue;
        }

        let fig = cloneFigure(baseFigure);
        const ruleIndex = (row * 3 + col) % selectedRules.length;
        fig = applyRule(fig, selectedRules[ruleIndex], rng);
        cells.push(fig);
      }
    }

    const answerIndex = Math.floor(rng() * 8);
    const answerFigure = applyRule(baseFigure, selectedRules[2 % selectedRules.length], rng);

    const options: Figure[] = [];
    for (let opt = 0; opt < 8; opt++) {
      if (opt === answerIndex) {
        options.push(answerFigure);
      } else {
        const wrongRule = pick(
          ruleTypes.filter((r) => r !== selectedRules[2 % selectedRules.length]),
          rng,
        );
        options.push(applyRule(baseFigure, wrongRule, rng));
      }
    }

    items.push({
      id: `item-${i}`,
      cells,
      options,
      answerIndex,
      difficulty: 0.5 + rng() * 1.5,
      rules,
    });
  }

  return { seed, items };
}
