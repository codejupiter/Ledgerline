import { useEffect, useState } from 'react';
import { getFrameTimer, type FrameStats } from '../lib/frameTimer';

export function useFrameStats(): FrameStats {
  const [stats, setStats] = useState<FrameStats>({
    fps: 0,
    avgFrameMs: 0,
    worstFrameMs: 0,
    droppedFrames: 0,
    totalFrames: 0,
  });

  useEffect(() => {
    const timer = getFrameTimer();
    timer.start();
    const unsub = timer.subscribe(setStats);
    return () => {
      unsub();
      // Don't stop the timer — it's app-wide.
    };
  }, []);

  return stats;
}
