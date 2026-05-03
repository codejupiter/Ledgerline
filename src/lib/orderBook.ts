/**
 * OrderBook engine for Binance depth streams.
 *
 * Binance offers two depth feeds:
 *   1. <symbol>@depth<levels>@100ms  - partial book snapshot every 100ms
 *      (we use this — simpler than maintaining a full book from a snapshot
 *      + diff stream, and it's plenty for a UI demo with deep enough levels)
 *
 * Bids: descending price (highest first)
 * Asks: ascending price (lowest first)
 */

export interface BookLevel {
  price: number;
  size: number;
  /** Cumulative size from top of book through this level. */
  cumSize: number;
}

export interface OrderBookSnapshot {
  bids: BookLevel[];
  asks: BookLevel[];
  /** Mid price = (best bid + best ask) / 2 */
  mid: number;
  /** Spread in absolute terms */
  spread: number;
  /** Spread in basis points */
  spreadBps: number;
  /** Max cumulative size across both sides — useful for normalizing depth bars. */
  maxCum: number;
  updatedAt: number;
}

export class OrderBookEngine {
  private latest: OrderBookSnapshot = {
    bids: [],
    asks: [],
    mid: 0,
    spread: 0,
    spreadBps: 0,
    maxCum: 0,
    updatedAt: 0,
  };
  private listeners = new Set<(s: OrderBookSnapshot) => void>();

  /** Apply a Binance partial book event:
   *  { lastUpdateId, bids: [["price","size"], ...], asks: [...] }
   */
  applyPartial(event: any) {
    if (!event || !Array.isArray(event.bids) || !Array.isArray(event.asks)) return;

    const bids: BookLevel[] = [];
    let cum = 0;
    for (const [pStr, sStr] of event.bids) {
      const price = parseFloat(pStr);
      const size = parseFloat(sStr);
      if (size === 0) continue;
      cum += size;
      bids.push({ price, size, cumSize: cum });
    }

    const asks: BookLevel[] = [];
    cum = 0;
    for (const [pStr, sStr] of event.asks) {
      const price = parseFloat(pStr);
      const size = parseFloat(sStr);
      if (size === 0) continue;
      cum += size;
      asks.push({ price, size, cumSize: cum });
    }

    if (bids.length === 0 || asks.length === 0) return;

    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
    const mid = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;
    const spreadBps = mid > 0 ? (spread / mid) * 10000 : 0;
    const maxCum = Math.max(
      bids[bids.length - 1]?.cumSize ?? 0,
      asks[asks.length - 1]?.cumSize ?? 0
    );

    this.latest = {
      bids,
      asks,
      mid,
      spread,
      spreadBps,
      maxCum,
      updatedAt: performance.now(),
    };

    for (const l of this.listeners) {
      try {
        l(this.latest);
      } catch (e) {
        console.error(e);
      }
    }
  }

  subscribe(fn: (s: OrderBookSnapshot) => void): () => void {
    this.listeners.add(fn);
    if (this.latest.updatedAt > 0) fn(this.latest);
    return () => this.listeners.delete(fn);
  }

  snapshot(): OrderBookSnapshot {
    return this.latest;
  }
}
