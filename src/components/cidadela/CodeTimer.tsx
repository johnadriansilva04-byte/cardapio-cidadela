import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

type CodeTimerProps = {
  expiresAt: string;
  onExpire: () => void;
};

export function CodeTimer({ expiresAt, onExpire }: CodeTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;
      return Math.max(0, diff);
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isExpiringSoon = timeLeft < 60000; // Menos de 1 minuto

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold shadow-lg ${
      isExpiringSoon 
        ? 'bg-red-500/90 text-white animate-pulse' 
        : 'bg-black/90 text-cyan-400 border border-cyan-500/50'
    }`}>
      <Clock className="size-4" />
      <span>{formatTime(timeLeft)}</span>
    </div>
  );
}
