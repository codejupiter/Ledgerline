/**
 * Frame timer: tracks rolling FPS and frame budget overruns via requestAnimationFrame.
 */

export interface FrameStats {
  fps: number;
  /** Average frame time in ms over the rolling window. */
  avgFrameMs: number;
  /** Worst frame time in ms over the rolling window. */
  worstFrameMs: number;
  /** Count of frames that exceeded 16.7ms (dropped frame budget) in the window. */
  droppedFrames: number;
  /** Total frames observed since start. */
  totalFrames: number;
}

export class FrameTimer {
  private samples: number[] = [];
  private maxSamples = 120;
  private last = 0;
  private rafId = 0;
  private running = false;
  private listeners = new Set<(s: FrameStats) => void>();
  private totalFrames = 0;
  private updateAccumMs = 0;

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (t: number) => {
      if (!this.running) return;
      const dt = t - this.last;
      this.last = t;
      this.totalFrames++;
      this.samples.push(dt);
      if (this.samples.length > this.maxSamples) this.samples.shift();
      this.updateAccumMs += dt;
      // Emit stats ~5 times per second to avoid React thrash.
      if (this.updateAccumMs >= 200) {
        this.updateAccumMs = 0;
        this.emit();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  subscribe(fn: (s: FrameStats) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    if (this.samples.length === 0) return;
    let sum = 0;
    let worst = 0;
    let dropped = 0;
    for (const s of this.samples) {
      sum += s;
      if (s > worst) worst = s;
      if (s > 16.7) dropped++;
    }
    const avg = sum / this.samples.length;
    const stats: FrameStats = {
      fps: avg > 0 ? Math.round(1000 / avg) : 0,
      avgFrameMs: avg,
      worstFrameMs: worst,
      droppedFrames: dropped,
      totalFrames: this.totalFrames,
    };
    for (const l of this.listeners) {
      try {
        l(stats);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

let _instance: FrameTimer | null = null;
export function getFrameTimer(): FrameTimer {
  if (!_instance) _instance = new FrameTimer();
  return _instance;
}
