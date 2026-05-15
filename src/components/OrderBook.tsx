import { useEffect, useRef, useState } from 'react';
import { OrderBookEngine, type OrderBookSnapshot } from '../lib/orderBook';
import { getBinanceClient } from '../lib/binanceClient';

interface Props {
  symbol: string;
  /** Number of levels to display per side. Default 15. */
  levels?: number;
}

const DEPTH_LEVELS = 20; // Binance partial book stream level

export function OrderBook({ symbol, levels = 15 }: Props) {
  const engineRef = useRef<OrderBookEngine | null>(null);
  const [book, setBook] = useState<OrderBookSnapshot | null>(null);

  useEffect(() => {
    const engine = new OrderBookEngine();
    engineRef.current = engine;

    const unsubBook = engine.subscribe(setBook);

    const client = getBinanceClient();
    const stream = `${symbol.toLowerCase()}@depth${DEPTH_LEVELS}@100ms`;
    const unsub = client.subscribe(stream, (msg) => {
      engine.applyPartial(msg);
    });

    return () => {
      unsub();
      unsubBook();
      engineRef.current = null;
    };
  }, [symbol]);

  // Always reserve container height to prevent CLS.
  const rowHeight = 22;
  const totalRows = levels * 2 + 1; // bids + asks + spread row
  const reservedHeight = rowHeight * totalRows + 40; // +header

  if (!book) {
    return (
      <div
        data-testid="order-book-loading"
        style={{
          height: reservedHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#5a5a52',
          fontSize: 12,
        }}
      >
        Loading order book…
      </div>
    );
  }

  const asks = book.asks.slice(0, levels).reverse(); // top-down: highest first
  const bids = book.bids.slice(0, levels);
  const maxCum = book.maxCum || 1;

  return (
    <div
      data-testid="order-book"
      style={{ height: reservedHeight, display: 'flex', flexDirection: 'column' }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          padding: '6px 12px',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#5a5a52',
          borderBottom: '1px solid #1a1a17',
        }}
      >
        <div>Price (USD)</div>
        <div style={{ textAlign: 'right' }}>Size (BTC)</div>
        <div style={{ textAlign: 'right' }}>Total</div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {/* Asks (top, red) */}
        {asks.map((lvl) => (
          <Row
            key={`a-${lvl.price}`}
            price={lvl.price}
            size={lvl.size}
            cumSize={lvl.cumSize}
            maxCum={maxCum}
            side="ask"
          />
        ))}

        {/* Spread row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            padding: '4px 12px',
            background: '#0f0f0d',
            borderTop: '1px solid #1a1a17',
            borderBottom: '1px solid #1a1a17',
            fontSize: 12,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div style={{ color: '#a8a89e' }}>
            {book.mid.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div style={{ color: '#5a5a52', textAlign: 'right' }}>
            spread {book.spread.toFixed(2)} ({book.spreadBps.toFixed(2)}bps)
          </div>
        </div>

        {/* Bids (bottom, green) */}
        {bids.map((lvl) => (
          <Row
            key={`b-${lvl.price}`}
            price={lvl.price}
            size={lvl.size}
            cumSize={lvl.cumSize}
            maxCum={maxCum}
            side="bid"
          />
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  price: number;
  size: number;
  cumSize: number;
  maxCum: number;
  side: 'bid' | 'ask';
}

function Row({ price, size, cumSize, maxCum, side }: RowProps) {
  const pct = Math.min(100, (cumSize / maxCum) * 100);
  const barColor = side === 'bid' ? 'rgba(143, 227, 178, 0.12)' : 'rgba(227, 123, 133, 0.12)';
  const priceColor = side === 'bid' ? '#8FE3B2' : '#E37B85';

  return (
    <div
      data-testid="order-row"
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        padding: '3px 12px',
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
        height: 22,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: `${pct}%`,
          background: barColor,
          pointerEvents: 'none',
        }}
        aria-hidden
      />
      <div style={{ position: 'relative', color: priceColor }}>
        {price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div style={{ position: 'relative', textAlign: 'right', color: '#c8c8be' }}>
        {size.toFixed(4)}
      </div>
      <div style={{ position: 'relative', textAlign: 'right', color: '#7a7a72' }}>
        {cumSize.toFixed(3)}
      </div>
    </div>
  );
}
