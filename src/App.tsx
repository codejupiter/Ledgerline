import { Chart } from './components/Chart';
import { OrderBook } from './components/OrderBook';
import { TradesTape } from './components/TradesTape';
import { PerfOverlay } from './components/PerfOverlay';
import { Header } from './components/Header';

const SYMBOL = 'BTCUSDT';

function App() {
  return (
    <div
      data-testid="ledgerline-app"
      className="ledgerline-app"
    >
      <Header symbol={SYMBOL} />

      <div
        data-testid="market-layout"
        className="ledgerline-main"
      >
        {/* Chart pane */}
        <div
          className="chart-pane"
        >
          <div
            className="panel-label chart-label"
          >
            Price · 1s candles · Binance live trades
          </div>
          <div className="chart-region">
            <Chart symbol={SYMBOL} bucketMs={1000} />
          </div>
        </div>

        {/* Right column: order book + trades */}
        <div data-testid="market-sidebar" className="market-sidebar">
          <div className="order-panel">
            <SectionLabel>Order Book · BTC/USDT</SectionLabel>
            <OrderBook symbol={SYMBOL} levels={15} />
          </div>
          <div className="trades-panel">
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
      className="panel-label"
    >
      {children}
    </div>
  );
}

export default App;
