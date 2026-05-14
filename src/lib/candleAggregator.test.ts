import { describe, expect, it } from 'vitest';
import { CandleAggregator } from './candleAggregator';

describe('CandleAggregator', () => {
  it('creates and updates a live candle within the same bucket', () => {
    const aggregator = new CandleAggregator({ bucketMs: 1000 });

    expect(aggregator.push(100, 0.5, 1_000)).toEqual({
      live: { time: 1, open: 100, high: 100, low: 100, close: 100, volume: 0.5 },
      closed: null,
    });

    expect(aggregator.push(104, 0.25, 1_200)).toEqual({
      live: { time: 1, open: 100, high: 104, low: 100, close: 104, volume: 0.75 },
      closed: null,
    });

    expect(aggregator.push(98, 0.75, 1_900)).toEqual({
      live: { time: 1, open: 100, high: 104, low: 98, close: 98, volume: 1.5 },
      closed: null,
    });
  });

  it('closes a candle when a new time bucket starts', () => {
    const aggregator = new CandleAggregator({ bucketMs: 1000 });

    aggregator.push(100, 1, 1_000);
    aggregator.push(102, 2, 1_500);
    const result = aggregator.push(105, 0.5, 2_000);

    expect(result.closed).toEqual({ time: 1, open: 100, high: 102, low: 100, close: 102, volume: 3 });
    expect(result.live).toEqual({ time: 2, open: 105, high: 105, low: 105, close: 105, volume: 0.5 });
    expect(aggregator.getCandles()).toEqual([result.closed, result.live]);
  });

  it('retains only the configured number of completed candles plus the live candle', () => {
    const aggregator = new CandleAggregator({ bucketMs: 1000, maxCandles: 2 });

    aggregator.push(100, 1, 1_000);
    aggregator.push(101, 1, 2_000);
    aggregator.push(102, 1, 3_000);
    aggregator.push(103, 1, 4_000);

    expect(aggregator.getCandles().map((candle) => candle.time)).toEqual([2, 3, 4]);
  });

  it('clears all retained state on reset', () => {
    const aggregator = new CandleAggregator();

    aggregator.push(100, 1, 1_000);
    aggregator.reset();

    expect(aggregator.getCandles()).toEqual([]);
  });
});
