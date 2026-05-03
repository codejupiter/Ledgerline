import { useEffect, useRef } from 'react';
import { createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { CandleAggregator } from '../lib/candleAggregator';
import { getBinanceClient } from '../lib/binanceClient';

interface Props {
  symbol: string; // e.g. "BTCUSDT"
  bucketMs?: number;
}

export function Chart({ symbol, bucketMs = 1000 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const aggRef = useRef<CandleAggregator | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { color: '#0a0a09' },
        textColor: '#a8a89e',
        fontSize: 11,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      grid: {
        vertLines: { color: '#1a1a17' },
        horzLines: { color: '#1a1a17' },
      },
      rightPriceScale: { borderColor: '#1a1a17' },
      timeScale: {
        borderColor: '#1a1a17',
        timeVisible: true,
        secondsVisible: true,
      },
      crosshair: {
        mode: 1,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#8FE3B2',
      downColor: '#E37B85',
      borderUpColor: '#8FE3B2',
      borderDownColor: '#E37B85',
      wickUpColor: '#8FE3B2',
      wickDownColor: '#E37B85',
    });

    chartRef.current = chart;
    seriesRef.current = series;
    aggRef.current = new CandleAggregator({ bucketMs });

    // Resize observer keeps the chart sized with the container.
    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    });
    ro.observe(container);

    // Subscribe to the trade stream.
    const client = getBinanceClient();
    const stream = `${symbol.toLowerCase()}@trade`;
    const unsub = client.subscribe(stream, (msg) => {
      // Binance trade payload: { e, E, s, t, p, q, T, m, ... }
      const price = parseFloat(msg.p);
      const qty = parseFloat(msg.q);
      const tradeTime = msg.T ?? msg.E ?? Date.now();
      if (!Number.isFinite(price) || !Number.isFinite(qty)) return;

      const agg = aggRef.current!;
      const { live } = agg.push(price, qty, tradeTime);
      // Update the live candle without rebuilding the whole series.
      // lightweight-charts handles partial updates via series.update().
      // It correctly merges by `time`.
      seriesRef.current!.update({
        time: live.time as any,
        open: live.open,
        high: live.high,
        low: live.low,
        close: live.close,
      });
    });

    return () => {
      unsub();
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      aggRef.current = null;
    };
  }, [symbol, bucketMs]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        // Reserve space so the chart doesn't cause CLS while loading.
        minHeight: 300,
        contain: 'strict',
      }}
    />
  );
}
