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
      data-testid="market-header"
      className="ledgerline-header"
    >
      <div className="brand-lockup">
        <div className="brand-name">
          Ledgerline
        </div>
        <div className="brand-symbol">
          Live · {symbol}
        </div>
      </div>

      <div className="ticker-strip" aria-label="Market ticker">
        <Field
          id="last"
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
          id="change"
          label="24h Change"
          value={
            ticker
              ? `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`
              : '—'
          }
          valueColor={changeColor}
        />
        <Field
          id="high"
          label="24h High"
          value={
            ticker
              ? ticker.high24.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : '—'
          }
        />
        <Field
          id="low"
          label="24h Low"
          value={
            ticker
              ? ticker.low24.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : '—'
          }
        />
        <Field
          id="volume"
          label="24h Vol (BTC)"
          value={ticker ? ticker.volume.toFixed(2) : '—'}
        />
      </div>
    </header>
  );
}

function Field({
  id,
  label,
  value,
  valueColor,
  large,
}: {
  id: string;
  label: string;
  value: string;
  valueColor?: string;
  large?: boolean;
}) {
  return (
    <div className="ticker-field" data-testid={`ticker-${id}`}>
      <div className="ticker-label">
        {label}
      </div>
      <div
        className={large ? 'ticker-value ticker-value-large' : 'ticker-value'}
        style={{
          color: valueColor ?? '#c8c8be',
        }}
      >
        {value}
      </div>
    </div>
  );
}
