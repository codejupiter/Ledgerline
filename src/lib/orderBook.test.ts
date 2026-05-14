import { describe, expect, it, vi } from 'vitest';
import { OrderBookEngine } from './orderBook';

describe('OrderBookEngine', () => {
  it('computes cumulative depth, spread, midpoint, and max cumulative size', () => {
    const book = new OrderBookEngine();

    book.applyPartial({
      bids: [
        ['100.00', '0.50'],
        ['99.50', '1.25'],
        ['99.00', '0.00'],
      ],
      asks: [
        ['100.50', '0.75'],
        ['101.00', '1.50'],
      ],
    });

    expect(book.snapshot()).toMatchObject({
      bids: [
        { price: 100, size: 0.5, cumSize: 0.5 },
        { price: 99.5, size: 1.25, cumSize: 1.75 },
      ],
      asks: [
        { price: 100.5, size: 0.75, cumSize: 0.75 },
        { price: 101, size: 1.5, cumSize: 2.25 },
      ],
      mid: 100.25,
      spread: 0.5,
      spreadBps: (0.5 / 100.25) * 10000,
      maxCum: 2.25,
    });
    expect(book.snapshot().updatedAt).toBeGreaterThan(0);
  });

  it('notifies subscribers, replays the latest snapshot, and supports unsubscribe', () => {
    const book = new OrderBookEngine();
    const first = vi.fn();

    const unsubscribe = book.subscribe(first);
    book.applyPartial({
      bids: [['100', '1']],
      asks: [['101', '2']],
    });

    expect(first).toHaveBeenCalledTimes(1);

    const second = vi.fn();
    book.subscribe(second);
    expect(second).toHaveBeenCalledTimes(1);
    expect(second.mock.calls[0]?.[0]).toMatchObject({ mid: 100.5, spread: 1 });

    unsubscribe();
    book.applyPartial({
      bids: [['102', '1']],
      asks: [['103', '2']],
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('ignores malformed or empty snapshots without changing the latest book', () => {
    const book = new OrderBookEngine();

    book.applyPartial({
      bids: [['100', '1']],
      asks: [['101', '2']],
    });
    const stable = book.snapshot();

    book.applyPartial(null);
    book.applyPartial({ bids: [], asks: [['101', '1']] });
    book.applyPartial({ bids: [['100', '1']], asks: [] });

    expect(book.snapshot()).toBe(stable);
  });
});
