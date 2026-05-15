import { expect, test, type Page } from '@playwright/test';

async function installMockBinanceFeed(page: Page) {
  await page.addInitScript(() => {
    class MockBinanceWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;

      readyState = MockBinanceWebSocket.CONNECTING;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      private streams = new Set<string>();
      private timer: number | null = null;
      private price = 100_000;
      private tradeId = 1_000;

      constructor() {
        window.setTimeout(() => {
          this.readyState = MockBinanceWebSocket.OPEN;
          this.onopen?.(new Event('open'));
          this.timer = window.setInterval(() => this.emitTick(), 120);
        }, 0);
      }

      send(raw: string) {
        const msg = JSON.parse(raw) as {
          method?: string;
          params?: string[];
        };
        if (!Array.isArray(msg.params)) return;

        for (const stream of msg.params) {
          if (msg.method === 'UNSUBSCRIBE') {
            this.streams.delete(stream);
          } else {
            this.streams.add(stream);
          }
        }
      }

      close() {
        if (this.timer !== null) {
          window.clearInterval(this.timer);
          this.timer = null;
        }
        this.readyState = MockBinanceWebSocket.CLOSED;
        this.onclose?.(new CloseEvent('close'));
      }

      private emitTick() {
        const now = Date.now();
        this.tradeId += 1;
        this.price += Math.sin(this.tradeId / 4) * 12 + 4;

        for (const stream of this.streams) {
          if (stream.endsWith('@trade')) {
            this.emit(stream, {
              e: 'trade',
              E: now,
              s: 'BTCUSDT',
              t: this.tradeId,
              p: this.price.toFixed(2),
              q: (0.08 + (this.tradeId % 7) / 100).toFixed(4),
              T: now,
              m: this.tradeId % 2 === 0,
            });
          }

          if (stream.includes('@depth20@100ms')) {
            this.emit(stream, {
              lastUpdateId: this.tradeId,
              bids: this.levels(-1),
              asks: this.levels(1),
            });
          }

          if (stream.endsWith('@miniTicker')) {
            this.emit(stream, {
              e: '24hrMiniTicker',
              E: now,
              s: 'BTCUSDT',
              c: this.price.toFixed(2),
              o: '99500.00',
              h: '101250.00',
              l: '98750.00',
              v: '12450.42',
            });
          }
        }
      }

      private levels(direction: 1 | -1) {
        return Array.from({ length: 20 }, (_, index) => {
          const distance = index + 1;
          const price = this.price + direction * (distance * 8 + 2);
          const size = 0.12 + distance * 0.018;
          return [price.toFixed(2), size.toFixed(4)];
        });
      }

      private emit(stream: string, data: Record<string, unknown>) {
        this.onmessage?.(
          new MessageEvent('message', {
            data: JSON.stringify({ stream, data }),
          }),
        );
      }
    }

    window.WebSocket =
      MockBinanceWebSocket as unknown as typeof window.WebSocket;
  });
}

async function gotoApp(page: Page) {
  await installMockBinanceFeed(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('ledgerline-app')).toBeVisible();
  await expect(page.getByTestId('trade-row').first()).toBeVisible();
  await expect(page.getByTestId('order-row').first()).toBeVisible();
}

test('renders the realtime trading surface from a deterministic feed', async ({
  page,
}) => {
  await gotoApp(page);

  await expect(page.getByText('Ledgerline')).toBeVisible();
  await expect(page.getByText('Live · BTCUSDT')).toBeVisible();
  await expect(page.getByText('Price · 1s candles · Binance live trades')).toBeVisible();
  await expect(page.getByText('Order Book · BTC/USDT')).toBeVisible();
  await expect(page.getByText('Recent Trades')).toBeVisible();
  await expect(page.getByTestId('ticker-last')).not.toContainText('—');
  await expect(page.getByTestId('price-chart').locator('canvas').first()).toBeVisible();
  await expect(page.getByTestId('perf-overlay')).toContainText('Msg/s');
});

test('keeps the market layout responsive without horizontal overflow', async ({
  page,
}) => {
  await gotoApp(page);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );

  expect(hasHorizontalOverflow).toBe(false);
});

test('virtualized trades tape remains interactive after scrolling', async ({
  page,
}) => {
  await gotoApp(page);

  await page
    .getByTestId('trades-scroll')
    .evaluate((element) => {
      element.scrollTop = 180;
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

  await expect(page.getByTestId('trade-row').first()).toBeVisible();
});
