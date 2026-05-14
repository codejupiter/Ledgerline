import { useEffect, useRef, useState } from 'react';
import { getBinanceClient } from '../lib/binanceClient';

interface Trade {
  id: number;
  price: number;
  qty: number;
  time: number;
  buyerMaker: boolean; // if true, the aggressor was a seller (down trade)
}

interface Props {
  symbol: string;
  /** Maximum trades to retain. Default 500. */
  maxTrades?: number;
  /** Visible height in px. Default 380. */
  height?: number;
}

const ROW_HEIGHT = 20;

export function TradesTape({ symbol, maxTrades = 500, height = 380 }: Props) {
  const [tradeState, setTradeState] = useState<{ symbol: string; trades: Trade[] }>({ symbol, trades: [] });
  const tradesRef = useRef<Trade[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const trades = tradeState.symbol === symbol ? tradeState.trades : [];

  useEffect(() => {
    tradesRef.current = [];
    const client = getBinanceClient();
    const stream = `${symbol.toLowerCase()}@trade`;

    // Throttle React updates to ~10fps to avoid render thrash.
    let pending = false;
    let flushTimer: number | null = null;
    const flush = () => {
      pending = false;
      setTradeState({ symbol, trades: [...tradesRef.current] });
      flushTimer = null;
    };

    const unsub = client.subscribe(stream, (msg) => {
      const t: Trade = {
        id: msg.t,
        price: parseFloat(msg.p),
        qty: parseFloat(msg.q),
        time: msg.T,
        buyerMaker: !!msg.m,
      };
      tradesRef.current.unshift(t);
      if (tradesRef.current.length > maxTrades) {
        tradesRef.current.length = maxTrades;
      }
      if (!pending) {
        pending = true;
        flushTimer = window.setTimeout(flush, 100);
      }
    });

    return () => {
      if (flushTimer !== null) window.clearTimeout(flushTimer);
      unsub();
    };
  }, [symbol, maxTrades]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const visibleCount = Math.ceil(height / ROW_HEIGHT) + 4;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2);
  const endIdx = Math.min(trades.length, startIdx + visibleCount);
  const visible = trades.slice(startIdx, endIdx);

  return (
    <div style={{ height: height + 28, display: 'flex', flexDirection: 'column' }}>
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
        <div>Price</div>
        <div style={{ textAlign: 'right' }}>Size</div>
        <div style={{ textAlign: 'right' }}>Time</div>
      </div>

      <div
        ref={containerRef}
        onScroll={onScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          position: 'relative',
          // Reserve to prevent CLS.
          height,
          contain: 'strict',
        }}
      >
        {trades.length === 0 ? (
          <div
            style={{
              padding: 16,
              color: '#5a5a52',
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            Waiting for trades…
          </div>
        ) : (
          <div style={{ height: trades.length * ROW_HEIGHT, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: startIdx * ROW_HEIGHT,
                left: 0,
                right: 0,
              }}
            >
              {visible.map((t) => (
                <TradeRow key={t.id} trade={t} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const color = trade.buyerMaker ? '#E37B85' : '#8FE3B2';
  const date = new Date(trade.time);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        padding: '0 12px',
        height: ROW_HEIGHT,
        alignItems: 'center',
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div style={{ color }}>
        {trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div style={{ textAlign: 'right', color: '#c8c8be' }}>{trade.qty.toFixed(4)}</div>
      <div style={{ textAlign: 'right', color: '#5a5a52' }}>{time}</div>
    </div>
  );
}

function pad(n: number) {
  return n < 10 ? '0' + n : '' + n;
}
