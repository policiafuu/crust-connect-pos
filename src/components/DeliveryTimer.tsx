import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface DeliveryTimerProps {
  startTime: string | undefined;
}

export function DeliveryTimer({ startTime }: DeliveryTimerProps) {
  const [elapsed, setElapsed] = useState<string>('0s');

  useEffect(() => {
    if (!startTime) {
      setElapsed('--');
      return;
    }

    const updateTimer = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000); // segundos

      if (diff < 0) {
        setElapsed('0s');
        return;
      }

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (hours > 0) {
        setElapsed(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setElapsed(`${minutes}m ${seconds}s`);
      } else {
        setElapsed(`${seconds}s`);
      }
    };

    // Atualiza imediatamente
    updateTimer();

    // Atualiza a cada segundo
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  if (!startTime) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-full">
      <Clock className="w-4 h-4 text-orange-600" />
      <span className="text-sm font-mono font-semibold text-orange-600">
        {elapsed}
      </span>
    </div>
  );
}
