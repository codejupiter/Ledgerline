/**
 * Binance WebSocket client.
 *
 * Single multiplexed connection to wss://stream.binance.com:9443/stream
 * Handles:
 *   - Subscribe / unsubscribe to multiple streams over one socket
 *   - Auto-reconnect with exponential backoff
 *   - Backpressure: drops oldest pending messages if a slow consumer falls behind
 *   - Per-stream fan-out to multiple subscribers
 */

type Listener = (data: any) => void;

export interface BinanceClientOptions {
  /** Maximum messages buffered per stream before dropping oldest. Default 256. */
  maxBufferPerStream?: number;
  /** Reconnect base delay in ms. Default 1000. */
  reconnectBaseMs?: number;
  /** Reconnect max delay in ms. Default 30000. */
  reconnectMaxMs?: number;
}

interface SubscriberRecord {
  listeners: Set<Listener>;
  /** Ring buffer of recent messages for late subscribers / backpressure. */
  buffer: any[];
  /** True if we've sent a SUBSCRIBE for this stream. */
  subscribed: boolean;
}

type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed';

export class BinanceClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'idle';
  private subscribers = new Map<string, SubscriberRecord>();
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private idCounter = 1;
  private opts: Required<BinanceClientOptions>;
  /** True when the consumer has explicitly closed and we should not reconnect. */
  private closed = false;

  /** Public stats for the UI to display. */
  public stats = {
    messagesReceived: 0,
    messagesDropped: 0,
    reconnects: 0,
    lastLatencyMs: 0,
  };

  constructor(opts: BinanceClientOptions = {}) {
    this.opts = {
      maxBufferPerStream: opts.maxBufferPerStream ?? 256,
      reconnectBaseMs: opts.reconnectBaseMs ?? 1000,
      reconnectMaxMs: opts.reconnectMaxMs ?? 30000,
    };
  }

  /**
   * Subscribe to a Binance stream name (e.g. "btcusdt@trade", "btcusdt@depth20@100ms").
   * Returns an unsubscribe function.
   */
  subscribe(stream: string, listener: Listener): () => void {
    let rec = this.subscribers.get(stream);
    if (!rec) {
      rec = { listeners: new Set(), buffer: [], subscribed: false };
      this.subscribers.set(stream, rec);
    }
    rec.listeners.add(listener);

    // Replay buffered messages so a late subscriber gets context immediately.
    for (const msg of rec.buffer) {
      try {
        listener(msg);
      } catch (e) {
        console.error('[BinanceClient] listener replay error', e);
      }
    }

    // Open the socket if needed; subscribe to the stream once connected.
    if (this.state === 'idle') {
      this.connect();
    } else if (this.state === 'open' && !rec.subscribed) {
      this.sendSubscribe([stream]);
      rec.subscribed = true;
    }

    return () => {
      const r = this.subscribers.get(stream);
      if (!r) return;
      r.listeners.delete(listener);
      if (r.listeners.size === 0) {
        if (this.state === 'open' && r.subscribed) {
          this.sendUnsubscribe([stream]);
        }
        this.subscribers.delete(stream);
      }
    };
  }

  close() {
    this.closed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.state = 'closed';
  }

  private connect() {
    if (this.closed) return;
    this.state = 'connecting';
    const url = 'wss://data-stream.binance.vision/stream';
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.state = 'open';
      this.reconnectAttempts = 0;
      const streams = Array.from(this.subscribers.keys());
      if (streams.length > 0) {
        this.sendSubscribe(streams);
        for (const s of streams) {
          const rec = this.subscribers.get(s);
          if (rec) rec.subscribed = true;
        }
      }
    };

    ws.onmessage = (event) => {
      this.stats.messagesReceived++;
      let parsed: any;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      // Combined stream wrapper: { stream: "...", data: {...} }
      if (!parsed || typeof parsed !== 'object') return;
      const streamName = parsed.stream;
      const data = parsed.data;
      if (!streamName) return;

      const rec = this.subscribers.get(streamName);
      if (!rec) return;

      // Latency estimate: Binance trade events carry E (event time, ms).
      if (data && typeof data.E === 'number') {
        this.stats.lastLatencyMs = Date.now() - data.E;
      }

      // Buffer with cap.
      rec.buffer.push(data);
      if (rec.buffer.length > this.opts.maxBufferPerStream) {
        rec.buffer.shift();
        this.stats.messagesDropped++;
      }

      for (const listener of rec.listeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[BinanceClient] listener error', e);
        }
      }
    };

    ws.onclose = () => {
      this.state = 'closed';
      this.ws = null;
      for (const rec of this.subscribers.values()) {
        rec.subscribed = false;
      }
      if (!this.closed) this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire and trigger reconnect.
    };
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    this.stats.reconnects++;
    const delay = Math.min(
      this.opts.reconnectBaseMs * 2 ** (this.reconnectAttempts - 1),
      this.opts.reconnectMaxMs
    );
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private sendSubscribe(streams: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        method: 'SUBSCRIBE',
        params: streams,
        id: this.idCounter++,
      })
    );
  }

  private sendUnsubscribe(streams: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        method: 'UNSUBSCRIBE',
        params: streams,
        id: this.idCounter++,
      })
    );
  }
}

/** Singleton instance shared across the app. */
let _client: BinanceClient | null = null;

export function getBinanceClient(): BinanceClient {
  if (!_client) _client = new BinanceClient();
  return _client;
}
