import { useEffect, useState } from 'react';
import { getBinanceClient } from '../lib/binanceClient';

interface Props {
  symbol: string;
}

interface Ticker {
  last: number;
  prevClose: number;
  high24: number;
  low24: number;
  volume: number;
}

export function Header({ symbol }: Props) {
  const [ticker, setTicker] = useState<Ticker | null>(null);

  useEffect(() => {
    const client = getBinanceClient();
    // miniTicker pushes ~every 1s with 24h rolling stats.
    const stream = `${symbol.toLowerCase()}@miniTicker`;
    const unsub = client.subscribe(stream, (msg) => {
      // msg fields: c=close, o=open, h=high, l=low, v=base asset volume
      setTicker({
        last: parseFloat(msg.c),
        prevClose: parseFloat(msg.o),
        high24: parseFloat(msg.h),
        low24: parseFloat(msg.l),
        volume: parseFloat(msg.v),
      });
    });
    return unsub;
  }, [symbol]);

  const change = ticker ? ticker.last - ticker.prevClose : 0;
  const changePct = ticker && ticker.prevClose > 0 ? (change / ticker.prevClose) * 100 : 0;
  const changeColor = change >= 0 ? '#8FE3B2' : '#E37B85';

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        padding: '12px 24px',
        borderBottom: '1px solid #1a1a17',
        height: 64,
        background: '#0a0a09',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '0.02em' }}>
          Ledgerline
        </div>
        <div style={{ fontSize: 11, color: '#5a5a52', textTransform: 'uppercase' }}>
          Live · {symbol}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, flex: 1 }}>
        <Field
          label="Last"
          value={
            ticker
              ? ticker.last.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : '—'
          }
          valueColor={ticker ? changeColor : '#c8c8be'}
          large
        />
        <Field
          label="24h Change"
          value={
            ticker
              ? `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`
              : '—'
          }
          valueColor={changeColor}
        />
        <Field
          label="24h High"
          value={
            ticker
              ? ticker.high24.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : '—'
          }
        />
        <Field
          label="24h Low"
          value={
            ticker
              ? ticker.low24.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : '—'
          }
        />
        <Field
          label="24h Vol (BTC)"
          value={ticker ? ticker.volume.toFixed(2) : '—'}
        />
      </div>
    </header>
  );
}

function Field({
  label,
  value,
  valueColor,
  large,
}: {
  label: string;
  value: string;
  valueColor?: string;
  large?: boolean;
}) {
  return (
    <div style={{ minWidth: 110 }}>
      <div
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#5a5a52',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: large ? 22 : 14,
          fontVariantNumeric: 'tabular-nums',
          color: valueColor ?? '#c8c8be',
          fontWeight: large ? 600 : 400,
        }}
      >
        {value}
      </div>
    </div>
  );
}
