import { useEffect, useRef, useState } from "react";
import { PlaySquare } from "lucide-react";

const DURATION = 180; // 3 minutos

export default function VideoBonusModal({
  points,
  adSlot,
  onFinish,
}: {
  points: number;
  adSlot?: string;
  onFinish: (earnedBonus: boolean) => void;
}) {
  const [watching, setWatching] = useState(false);
  const [remaining, setRemaining] = useState(DURATION);
  const finished = useRef(false);

  useEffect(() => {
    if (!watching) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          if (!finished.current) {
            finished.current = true;
            onFinish(true);
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [watching, onFinish]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = ((DURATION - remaining) / DURATION) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-cyan-400/40 bg-black p-5 text-center">
        <h2 className="text-lg font-black text-white">
          Assista ao vídeo para ganhar pontos extras!
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Você ganhou {points} pontos. Assista ao vídeo para dobrar seus pontos!
        </p>

        <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl border border-cyan-400/30 bg-slate-900">
          {watching ? (
            <iframe
              title="Vídeo promocional Google AdSense"
              src={
                adSlot
                  ? `https://googleads.g.doubleclick.net/pagead/ads?slot=${encodeURIComponent(adSlot)}`
                  : "about:blank"
              }
              className="size-full"
            />
          ) : (
            <div className="grid size-full place-items-center">
              <PlaySquare className="size-12 text-cyan-400/60" />
            </div>
          )}
        </div>

        {watching && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-cyan-400 transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-bold text-cyan-300">
              {mm}:{ss} restantes
            </p>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => onFinish(false)}
            className="flex-1 rounded-full border border-gray-600 py-3 text-sm font-semibold text-gray-400"
          >
            Pular vídeo
          </button>
          {!watching && (
            <button
              onClick={() => setWatching(true)}
              className="flex-1 rounded-full bg-cyan-500 py-3 text-sm font-bold text-black"
            >
              Assistir vídeo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
