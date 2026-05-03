import { Chart } from './components/Chart';
import { OrderBook } from './components/OrderBook';
import { TradesTape } from './components/TradesTape';
import { PerfOverlay } from './components/PerfOverlay';
import { Header } from './components/Header';

const SYMBOL = 'BTCUSDT';

function App() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a09',
        color: '#c8c8be',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <Header symbol={SYMBOL} />

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gridTemplateRows: '1fr',
          overflow: 'hidden',
        }}
      >
        {/* Chart pane */}
        <div
          style={{
            borderRight: '1px solid #1a1a17',
            position: 'relative',
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: '8px 16px',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#5a5a52',
              borderBottom: '1px solid #1a1a17',
              height: 32,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Price · 1s candles · Binance live trades
          </div>
          <div style={{ position: 'absolute', top: 32, left: 0, right: 0, bottom: 0 }}>
            <Chart symbol={SYMBOL} bucketMs={1000} />
          </div>
        </div>

        {/* Right column: order book + trades */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ borderBottom: '1px solid #1a1a17' }}>
            <SectionLabel>Order Book · BTC/USDT</SectionLabel>
            <OrderBook symbol={SYMBOL} levels={15} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <SectionLabel>Recent Trades</SectionLabel>
            <TradesTape symbol={SYMBOL} maxTrades={500} height={300} />
          </div>
        </div>
      </div>

      <PerfOverlay />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '8px 16px',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: '#5a5a52',
        borderBottom: '1px solid #1a1a17',
      }}
    >
      {children}
    </div>
  );
}

export default App;
