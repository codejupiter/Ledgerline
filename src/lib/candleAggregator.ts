/**
 * Tick aggregator: converts a stream of trade ticks into OHLCV candles.
 *
 * Maintains a rolling window of completed candles plus the live in-progress
 * candle. Emits an update on every tick for the live candle, and a "close"
 * signal when a candle finalizes and a new bucket starts.
 */

export interface Candle {
  time: number; // bucket start, in seconds (lightweight-charts convention)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AggregatorOptions {
  /** Bucket size in milliseconds. Default 1000 (1s candles). */
  bucketMs?: number;
  /** Maximum number of completed candles to retain. Default 600. */
  maxCandles?: number;
}

export class CandleAggregator {
  private bucketMs: number;
  private maxCandles: number;
  private candles: Candle[] = [];
  private current: Candle | null = null;

  constructor(opts: AggregatorOptions = {}) {
    this.bucketMs = opts.bucketMs ?? 1000;
    this.maxCandles = opts.maxCandles ?? 600;
  }

  /**
   * Push a trade. Returns the live candle (in-progress or just closed)
   * and a flag indicating whether a candle just closed.
   */
  push(price: number, qty: number, tradeTimeMs: number): { live: Candle; closed: Candle | null } {
    const bucketStartMs = Math.floor(tradeTimeMs / this.bucketMs) * this.bucketMs;
    const bucketStartSec = Math.floor(bucketStartMs / 1000);

    let closed: Candle | null = null;

    if (!this.current) {
      this.current = {
        time: bucketStartSec,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: qty,
      };
      return { live: this.current, closed: null };
    }

    if (bucketStartSec > this.current.time) {
      // Close out the prior bucket.
      closed = this.current;
      this.candles.push(closed);
      while (this.candles.length > this.maxCandles) this.candles.shift();

      // Start a new bucket. Use the last close as the open if there were no
      // ticks in any intervening buckets — but for now, we open at the new tick.
      this.current = {
        time: bucketStartSec,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: qty,
      };
    } else {
      this.current.high = Math.max(this.current.high, price);
      this.current.low = Math.min(this.current.low, price);
      this.current.close = price;
      this.current.volume += qty;
    }

    return { live: this.current, closed };
  }

  /** Snapshot of all completed + live candle. */
  getCandles(): Candle[] {
    if (this.current) return [...this.candles, this.current];
    return [...this.candles];
  }

  reset() {
    this.candles = [];
    this.current = null;
  }
}
