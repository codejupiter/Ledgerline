import { useEffect, useRef } from 'react';
import { getBinanceClient } from '../lib/binanceClient';

/**
 * Subscribe to a Binance combined stream.
 * The handler is captured by ref so its closure doesn't trigger resubscription.
 */
export function useBinanceStream<T = any>(
  stream: string | null,
  handler: (data: T) => void
) {
  const ref = useRef(handler);

  useEffect(() => {
    ref.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!stream) return;
    const client = getBinanceClient();
    const unsub = client.subscribe(stream, (data) => {
      ref.current(data);
    });
    return unsub;
  }, [stream]);
}
