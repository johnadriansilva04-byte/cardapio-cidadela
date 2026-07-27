import { useState } from "react";

type Team = "red" | "blue";
type Position = { x: number; y: number };

const FIELD_WIDTH = 12;
const FIELD_HEIGHT = 8;

const INITIAL_POSITIONS: Record<Team, Position[]> = {
  red: [
    { x: 1, y: 4 },
    { x: 3, y: 2 },
    { x: 3, y: 4 },
    { x: 3, y: 6 },
    { x: 5, y: 4 },
  ],
  blue: [
    { x: 11, y: 4 },
    { x: 9, y: 2 },
    { x: 9, y: 4 },
    { x: 9, y: 6 },
    { x: 7, y: 4 },
  ],
};

export function FutebolBotao() {
  const [ball, setBall] = useState<Position>({ x: 6, y: 4 });
  const [positions, setPositions] = useState(INITIAL_POSITIONS);
  const [turn, setTurn] = useState<Team>("red");
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [score, setScore] = useState({ red: 0, blue: 0 });

  function movePlayer(team: Team, playerIndex: number, dx: number, dy: number) {
    if (team !== turn) return;

    const newPositions = { ...positions };
    const currentPos = newPositions[team][playerIndex];
    const newPos = { x: currentPos.x + dx, y: currentPos.y + dy };

    if (
      newPos.x < 0 ||
      newPos.x >= FIELD_WIDTH ||
      newPos.y < 0 ||
      newPos.y >= FIELD_HEIGHT
    ) {
      return;
    }

    newPositions[team][playerIndex] = newPos;
    setPositions(newPositions);

    checkBallCollision(newPos);
    setTurn(team === "red" ? "blue" : "red");
    setSelectedPlayer(null);
  }

  function checkBallCollision(playerPos: Position) {
    if (Math.abs(playerPos.x - ball.x) <= 1 && Math.abs(playerPos.y - ball.y) <= 1) {
      const dx = ball.x - playerPos.x;
      const dy = ball.y - playerPos.y;
      const newBallX = Math.max(0, Math.min(FIELD_WIDTH - 1, ball.x + dx));
      const newBallY = Math.max(0, Math.min(FIELD_HEIGHT - 1, ball.y + dy));
      setBall({ x: newBallX, y: newBallY });

      if (newBallX === 0 || newBallX === FIELD_WIDTH - 1) {
        const scoringTeam = newBallX === 0 ? "blue" : "red";
        setScore((prev) => ({ ...prev, [scoringTeam]: prev[scoringTeam] + 1 }));
        setBall({ x: 6, y: 4 });
        setPositions(INITIAL_POSITIONS);
      }
    }
  }

  function resetGame() {
    setBall({ x: 6, y: 4 });
    setPositions(INITIAL_POSITIONS);
    setTurn("red");
    setSelectedPlayer(null);
    setScore({ red: 0, blue: 0 });
  }

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-tech text-sm">
              Vermelho: <span className="font-bold text-red-500">{score.red}</span>
            </span>
            <span className="text-tech text-sm">
              Azul: <span className="font-bold text-blue-500">{score.blue}</span>
            </span>
          </div>
          <span className="text-tech text-sm">
            Turno: <span className={turn === "red" ? "text-red-500" : "text-blue-500"}>{turn === "red" ? "Vermelho" : "Azul"}</span>
          </span>
          <button
            type="button"
            onClick={resetGame}
            className="text-tech rounded-md bg-secondary px-3 py-1 text-xs"
          >
            Reiniciar
          </button>
        </div>

        <div className="relative rounded-lg border-2 border-border bg-green-900/20 p-4">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${FIELD_WIDTH}, 1fr)` }}>
            {Array.from({ length: FIELD_HEIGHT }).map((_, y) =>
              Array.from({ length: FIELD_WIDTH }).map((_, x) => {
                const redPlayer = positions.red.findIndex((p) => p.x === x && p.y === y);
                const bluePlayer = positions.blue.findIndex((p) => p.x === x && p.y === y);
                const isBall = ball.x === x && ball.y === y;

                return (
                  <div
                    key={`${x}-${y}`}
                    className={`aspect-square rounded border border-green-800/30 ${
                      x === FIELD_WIDTH / 2 - 1 || x === FIELD_WIDTH / 2 ? "border-x-2 border-green-700/50" : ""
                    }`}
                  >
                    {redPlayer !== -1 && (
                      <button
                        type="button"
                        onClick={() => setSelectedPlayer(selectedPlayer === redPlayer ? null : redPlayer)}
                        className={`size-full rounded-full ${
                          selectedPlayer === redPlayer && turn === "red"
                            ? "bg-red-500 ring-2 ring-white"
                            : "bg-red-600"
                        } transition-all`}
                      />
                    )}
                    {bluePlayer !== -1 && (
                      <button
                        type="button"
                        onClick={() => setSelectedPlayer(selectedPlayer === bluePlayer + 100 ? null : bluePlayer + 100)}
                        className={`size-full rounded-full ${
                          selectedPlayer === bluePlayer + 100 && turn === "blue"
                            ? "bg-blue-500 ring-2 ring-white"
                            : "bg-blue-600"
                        } transition-all`}
                      />
                    )}
                    {isBall && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="size-3 rounded-full bg-white shadow-lg" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {selectedPlayer !== null && turn === "red" && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <button
                type="button"
                onClick={() => movePlayer("red", selectedPlayer, -1, 0)}
                className="rounded bg-secondary px-3 py-2 text-xs"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => movePlayer("red", selectedPlayer, 0, -1)}
                className="rounded bg-secondary px-3 py-2 text-xs"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => movePlayer("red", selectedPlayer, 0, 1)}
                className="rounded bg-secondary px-3 py-2 text-xs"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => movePlayer("red", selectedPlayer, 1, 0)}
                className="rounded bg-secondary px-3 py-2 text-xs"
              >
                →
              </button>
            </div>
          )}

          {selectedPlayer !== null && turn === "blue" && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <button
                type="button"
                onClick={() => movePlayer("blue", selectedPlayer - 100, -1, 0)}
                className="rounded bg-secondary px-3 py-2 text-xs"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => movePlayer("blue", selectedPlayer - 100, 0, -1)}
                className="rounded bg-secondary px-3 py-2 text-xs"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => movePlayer("blue", selectedPlayer - 100, 0, 1)}
                className="rounded bg-secondary px-3 py-2 text-xs"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => movePlayer("blue", selectedPlayer - 100, 1, 0)}
                className="rounded bg-secondary px-3 py-2 text-xs"
              >
                →
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Clique no seu jogador e use as setas para mover. Chute a bola para marcar!
        </p>
      </div>
    </div>
  );
}
