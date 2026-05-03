# Ledgerline

Real-time cryptocurrency trading interface. Streams live BTC/USDT data from Binance over WebSocket and renders it without dropped frames or layout shift.

## What it does

- **Live candlestick chart** — 1-second OHLCV candles built from the raw trade tick stream, rendered with TradingView's Lightweight Charts.
- **Order book** — top 15 levels of bids and asks with cumulative-depth bars, refreshing every 100ms from Binance's partial book stream.
- **Trades tape** — virtualized scrolling list of the most recent 500 trades, color-coded by aggressor side.
- **Header ticker** — last price, 24h change/high/low/volume.
- **Performance overlay** — live FPS, frame timing, dropped-frame count, message rate, latency, reconnects.

## Architecture

```
src/
├── lib/
│   ├── binanceClient.ts     # Multiplexed WS client with reconnect + backpressure
│   ├── candleAggregator.ts  # Trade ticks -> OHLCV candles
│   ├── orderBook.ts         # Sorted book engine for depth events
│   └── frameTimer.ts        # rAF-based FPS instrumentation
├── components/
│   ├── Chart.tsx            # Candlestick chart
│   ├── OrderBook.tsx        # Depth visualization
│   ├── TradesTape.tsx       # Virtualized trade list
│   ├── PerfOverlay.tsx      # FPS + msg/sec overlay
│   └── Header.tsx           # Symbol + 24h stats
└── hooks/
    ├── useBinanceStream.ts
    └── useFrameStats.ts
```

### Single multiplexed WebSocket

All streams (`@trade`, `@depth20@100ms`, `@miniTicker`) share one connection to `wss://stream.binance.com:9443/stream` via the `BinanceClient`. The client supports:

- SUBSCRIBE / UNSUBSCRIBE messages over a single socket
- Per-stream subscriber registries with fan-out to multiple listeners
- Ring-buffer backpressure: when a stream's buffer exceeds a cap, oldest messages are dropped (counted in stats) so a slow consumer can't OOM the page
- Automatic reconnect with exponential backoff (1s → 2s → 4s → … → 30s cap)
- On reconnect, all active stream subscriptions are re-registered

### Layout-shift prevention

Every panel reserves its final height before data arrives:
- Chart container has `min-height: 300` and `contain: strict`
- Order book reserves `(rowHeight × levels × 2) + spreadRow` even while empty
- Trades tape reserves a fixed `height` and shows a placeholder until the first trade

This keeps Cumulative Layout Shift at 0 throughout the load sequence.

### Render budget

- Chart updates use `series.update()` which mutates the live candle in place — no full series rebuild per tick
- Trades tape throttles React state updates to 10 Hz; new trades accumulate in a ref between renders
- Order book updates at the rate of the depth feed (10 Hz) directly via setState — list size is bounded
- Trades list is virtualized (only visible rows + 4 row buffer mount)
- The performance overlay updates at ~5 Hz, not per-frame

## Running

```
npm install
npm run dev
```

Open http://localhost:5174/

## Stack

- React 18 + TypeScript
- Vite
- Lightweight Charts (TradingView's open-source chart library — production-grade rendering used by major exchanges)
- Binance public WebSocket API (no auth required for public market data)

## License

MIT
