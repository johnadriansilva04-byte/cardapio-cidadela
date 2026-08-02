/**
 * Grafo do tabuleiro da Trilha (Nine Men's Morris).
 * 24 nós dispostos em 3 quadrados concêntricos ligados por 4 eixos ortogonais.
 *
 *  0-----------1-----------2
 *  |           |           |
 *  |   8-------9------10   |
 *  |   |       |       |   |
 *  |   |  16--17--18   |   |
 *  |   |   |       |   |   |
 *  7--15--23      19--11---3
 *  |   |   |       |   |   |
 *  |   |  22--21--20   |   |
 *  |   |       |       |   |
 *  |  14------13------12   |
 *  |           |           |
 *  6-----------5-----------4
 */

export const NODE_COUNT = 24;

/** Coordenadas em grade 0..6 (x, y) usadas para renderização SVG. */
export const NODE_COORDS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [3, 0], [6, 0], [6, 3], [6, 6], [3, 6], [0, 6], [0, 3], // anel externo 0-7
  [1, 1], [3, 1], [5, 1], [5, 3], [5, 5], [3, 5], [1, 5], [1, 3], // anel médio  8-15
  [2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [2, 3], // anel interno 16-23
];

/** Nomes táticos dos setores (usado no log de operações). */
export const NODE_LABELS: readonly string[] = NODE_COORDS.map((_, i) => {
  const ring = i < 8 ? "P" : i < 16 ? "S" : "T"; // Perímetro / Setor / Trincheira
  return `${ring}${(i % 8) + 1}`;
});

function ringCycle(base: number): Array<[number, number]> {
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < 8; i++) edges.push([base + i, base + ((i + 1) % 8)]);
  return edges;
}

const EDGES: Array<[number, number]> = [
  ...ringCycle(0),
  ...ringCycle(8),
  ...ringCycle(16),
  // eixos ortogonais (meio de cada lado)
  [1, 9], [9, 17],
  [3, 11], [11, 19],
  [5, 13], [13, 21],
  [7, 15], [15, 23],
];

/** Matriz de adjacência: vizinhos diretos permitidos para movimentação. */
export const ADJACENCY: ReadonlyArray<readonly number[]> = (() => {
  const adj: number[][] = Array.from({ length: NODE_COUNT }, () => []);
  for (const [a, b] of EDGES) {
    adj[a]!.push(b);
    adj[b]!.push(a);
  }
  return adj.map((list) => list.sort((x, y) => x - y));
})();

/** Todas as 16 trincas (moinhos) possíveis. */
export const MILLS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0],
  [8, 9, 10], [10, 11, 12], [12, 13, 14], [14, 15, 8],
  [16, 17, 18], [18, 19, 20], [20, 21, 22], [22, 23, 16],
  [1, 9, 17], [3, 11, 19], [5, 13, 21], [7, 15, 23],
];

/** Índice: nó -> moinhos que o contêm (pré-computado para performance da IA). */
export const MILLS_BY_NODE: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> =
  (() => {
    const map: Array<Array<readonly [number, number, number]>> = Array.from(
      { length: NODE_COUNT },
      () => [],
    );
    for (const mill of MILLS) for (const n of mill) map[n]!.push(mill);
    return map;
  })();

/** Segmentos de linha desenháveis (evita duplicar traços do SVG). */
export const BOARD_EDGES: ReadonlyArray<readonly [number, number]> = EDGES;
