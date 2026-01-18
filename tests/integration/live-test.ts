/**
 * ARGUS Live Integration Test
 * Tests Binance API with live data and runs backtest
 */

import { BinanceFetcher } from '../../src/fetchers/binance';
import { BacktestEngine } from '../../src/backtest/engine';
import type { BacktestData, PriceBar } from '../../src/backtest/types';
import type { Signal } from '../../src/strategies/types';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  data?: unknown;
}

const results: TestResult[] = [];
const bugs: Array<{ title: string; description: string; severity: 'critical' | 'high' | 'medium' | 'low' }> = [];

async function testBinanceAPI() {
  console.log('\n=== ARGUS: Testing Binance API ===\n');

  const fetcher = new BinanceFetcher();

  // Test 1: Get current price for BTCUSDT
  console.log('Test 1: Fetching BTCUSDT quote...');
  try {
    const quote = await fetcher.getCurrentPrice('BTCUSDT');
    console.log(`  Price: $${quote.data.price.toLocaleString()}`);
    console.log(`  Bid: $${quote.data.bid.toLocaleString()}`);
    console.log(`  Ask: $${quote.data.ask.toLocaleString()}`);
    console.log(`  Latency: ${quote.latencyMs}ms`);

    if (quote.data.price > 0 && quote.data.bid > 0 && quote.data.ask > 0) {
      results.push({ name: 'Binance BTCUSDT Quote', passed: true, data: quote.data });
    } else {
      results.push({ name: 'Binance BTCUSDT Quote', passed: false, error: 'Invalid price data' });
      bugs.push({
        title: 'Binance API returns invalid price data',
        description: 'Quote endpoint returns zero or negative prices',
        severity: 'critical'
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  ERROR: ${msg}`);
    results.push({ name: 'Binance BTCUSDT Quote', passed: false, error: msg });
    bugs.push({
      title: 'Binance API quote fetch fails',
      description: `Error fetching BTCUSDT quote: ${msg}`,
      severity: 'critical'
    });
  }

  // Test 2: Get historical data for ETHUSDT
  console.log('\nTest 2: Fetching ETHUSDT historical data (30 days)...');
  try {
    const endTime = Date.now();
    const startTime = endTime - 30 * 24 * 60 * 60 * 1000;

    const history = await fetcher.getHistoricalData('ETHUSDT', '1d', {
      startTime,
      endTime,
      limit: 30,
    });

    console.log(`  Bars received: ${history.data.length}`);
    if (history.data.length > 0) {
      const latest = history.data[history.data.length - 1];
      console.log(`  Latest: O=${latest.open.toFixed(2)} H=${latest.high.toFixed(2)} L=${latest.low.toFixed(2)} C=${latest.close.toFixed(2)}`);
    }
    console.log(`  Latency: ${history.latencyMs}ms`);

    if (history.data.length >= 20) {
      results.push({ name: 'Binance ETHUSDT Historical', passed: true, data: { bars: history.data.length } });
    } else {
      results.push({ name: 'Binance ETHUSDT Historical', passed: false, error: `Only ${history.data.length} bars returned` });
      bugs.push({
        title: 'Binance API returns insufficient historical data',
        description: `Expected 30 bars, got ${history.data.length}`,
        severity: 'medium'
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  ERROR: ${msg}`);
    results.push({ name: 'Binance ETHUSDT Historical', passed: false, error: msg });
    bugs.push({
      title: 'Binance API historical fetch fails',
      description: `Error fetching ETHUSDT history: ${msg}`,
      severity: 'high'
    });
  }

  // Test 3: Get order book
  console.log('\nTest 3: Fetching BTCUSDT order book...');
  try {
    const orderBook = await fetcher.getOrderBook('BTCUSDT', 10);
    console.log(`  Bids: ${orderBook.data.bids.length}`);
    console.log(`  Asks: ${orderBook.data.asks.length}`);
    if (orderBook.data.bids.length > 0) {
      console.log(`  Best bid: $${orderBook.data.bids[0].price.toLocaleString()} x ${orderBook.data.bids[0].quantity}`);
    }
    if (orderBook.data.asks.length > 0) {
      console.log(`  Best ask: $${orderBook.data.asks[0].price.toLocaleString()} x ${orderBook.data.asks[0].quantity}`);
    }

    if (orderBook.data.bids.length > 0 && orderBook.data.asks.length > 0) {
      results.push({ name: 'Binance Order Book', passed: true });
    } else {
      results.push({ name: 'Binance Order Book', passed: false, error: 'Empty order book' });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  ERROR: ${msg}`);
    results.push({ name: 'Binance Order Book', passed: false, error: msg });
  }

  // Test 4: Asset info
  console.log('\nTest 4: Fetching SOLUSDT asset info...');
  try {
    const info = await fetcher.getAssetInfo('SOLUSDT');
    console.log(`  Name: ${info.data.name}`);
    console.log(`  Exchange: ${info.data.exchange}`);
    console.log(`  Type: ${info.data.type}`);
    console.log(`  Currency: ${info.data.currency}`);

    results.push({ name: 'Binance Asset Info', passed: true, data: info.data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  ERROR: ${msg}`);
    results.push({ name: 'Binance Asset Info', passed: false, error: msg });
  }

  // Test 5: Health check
  console.log('\nTest 5: Binance health check...');
  try {
    const healthy = await fetcher.healthCheck();
    console.log(`  Healthy: ${healthy}`);

    results.push({ name: 'Binance Health Check', passed: healthy });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    results.push({ name: 'Binance Health Check', passed: false, error: msg });
  }

  return fetcher;
}

async function testBacktest(fetcher: BinanceFetcher) {
  console.log('\n=== ARGUS: Testing Backtest Engine ===\n');

  // Fetch historical data for backtest
  console.log('Fetching historical data for backtest (BTCUSDT, 90 days)...');

  try {
    const endTime = Date.now();
    const startTime = endTime - 90 * 24 * 60 * 60 * 1000;

    const history = await fetcher.getHistoricalData('BTCUSDT', '1d', {
      startTime,
      endTime,
      limit: 100,
    });

    if (history.data.length < 30) {
      results.push({ name: 'Backtest Data Fetch', passed: false, error: 'Insufficient data' });
      bugs.push({
        title: 'Insufficient historical data for backtest',
        description: `Only ${history.data.length} bars available for 90-day backtest`,
        severity: 'medium'
      });
      return;
    }

    console.log(`  Data points: ${history.data.length}`);

    // Convert to backtest format
    const priceData: Map<string, PriceBar[]> = new Map();
    priceData.set('BTCUSDT', history.data.map(bar => ({
      timestamp: bar.timestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
    })));

    const backtestData: BacktestData = {
      prices: priceData,
      startDate: history.data[0].timestamp,
      endDate: history.data[history.data.length - 1].timestamp,
      symbols: ['BTCUSDT'],
    };

    // Run backtest with simple momentum strategy
    console.log('\nRunning momentum strategy backtest...');

    const engine = new BacktestEngine({
      initialCapital: 100000,
      commission: 0.001, // 0.1%
      slippage: 0.0005, // 0.05%
    });

    // Simple momentum signal generator (uses direction/strength format to test normalization)
    const momentumSignals = (date: number, prices: Map<string, PriceBar>): Signal[] => {
      const signals: Signal[] = [];
      const btc = prices.get('BTCUSDT');

      if (btc) {
        // Simple: if price > open, buy signal; otherwise sell
        if (btc.close > btc.open * 1.01) {
          signals.push({
            symbol: 'BTCUSDT',
            direction: 'long',
            strength: 0.8,
            timestamp: date,
          } as unknown as Signal);
        } else if (btc.close < btc.open * 0.99) {
          signals.push({
            symbol: 'BTCUSDT',
            direction: 'short',
            strength: 0.5,
            timestamp: date,
          } as unknown as Signal);
        }
      }

      return signals;
    };

    const result = engine.run(backtestData, momentumSignals);
    console.log('\n  Backtest Results:');
    console.log(`  Total Return: ${result.metrics.totalReturn.toFixed(2)}%`);
    console.log(`  Sharpe Ratio: ${result.metrics.sharpeRatio.toFixed(3)}`);
    console.log(`  Max Drawdown: ${result.metrics.maxDrawdown.toFixed(2)}%`);
    console.log(`  Win Rate: ${result.metrics.winRate.toFixed(1)}%`);
    console.log(`  Total Trades: ${result.metrics.totalTrades}`);
    console.log(`  Final Value: $${result.metrics.finalValue.toLocaleString()}`);

    // Validate results
    if (result.metrics.totalTrades > 0) {
      results.push({
        name: 'Backtest Execution',
        passed: true,
        data: {
          totalReturn: result.metrics.totalReturn,
          sharpeRatio: result.metrics.sharpeRatio,
          trades: result.metrics.totalTrades,
        }
      });
    } else {
      results.push({ name: 'Backtest Execution', passed: false, error: 'No trades executed' });
      bugs.push({
        title: 'Backtest engine executes no trades',
        description: 'Momentum strategy generated signals but no trades were executed',
        severity: 'high'
      });
    }

    // Check for NaN or extreme values
    if (isNaN(result.metrics.sharpeRatio) || isNaN(result.metrics.totalReturn)) {
      bugs.push({
        title: 'Backtest returns NaN metrics',
        description: 'Sharpe ratio or total return contains NaN values',
        severity: 'high'
      });
    }

    // Check for extreme Sharpe ratio (indicates divide by zero)
    if (Math.abs(result.metrics.sharpeRatio) > 1e10) {
      bugs.push({
        title: 'Backtest Sharpe ratio overflow',
        description: `Sharpe ratio is ${result.metrics.sharpeRatio} - likely divide by zero when volatility is 0`,
        severity: 'high'
      });
    }

    // Check if trades were executed when signals were generated
    if (result.metrics.totalTrades === 0) {
      bugs.push({
        title: 'Backtest engine does not execute trades from signals',
        description: 'Momentum strategy generates signals but BacktestEngine.run() executes 0 trades. Signal processing may be broken.',
        severity: 'critical'
      });
    }

    // Check equity curve
    if (result.equityCurve.length === 0) {
      bugs.push({
        title: 'Backtest equity curve is empty',
        description: 'No equity points recorded during backtest',
        severity: 'medium'
      });
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  ERROR: ${msg}`);
    results.push({ name: 'Backtest Execution', passed: false, error: msg });
    bugs.push({
      title: 'Backtest engine throws error',
      description: `Error during backtest: ${msg}`,
      severity: 'critical'
    });
  }
}

function printReport() {
  console.log('\n' + '='.repeat(60));
  console.log('ARGUS TEST REPORT');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Tests: ${passed} passed, ${failed} failed, ${results.length} total\n`);

  for (const result of results) {
    const status = result.passed ? '✓' : '✗';
    console.log(`  ${status} ${result.name}${result.error ? ` - ${result.error}` : ''}`);
  }

  if (bugs.length > 0) {
    console.log('\n' + '-'.repeat(60));
    console.log('BUGS FOUND');
    console.log('-'.repeat(60) + '\n');

    for (const bug of bugs) {
      console.log(`  [${bug.severity.toUpperCase()}] ${bug.title}`);
      console.log(`    ${bug.description}\n`);
    }
  } else {
    console.log('\n  No bugs found.');
  }

  console.log('\n' + '='.repeat(60));

  return { results, bugs, passed, failed };
}

// Main execution
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    ARGUS TEST SUITE                       ║');
  console.log('║               MaxTrade Live Integration                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const fetcher = await testBinanceAPI();
  await testBacktest(fetcher);

  return printReport();
}

main().then(report => {
  // Output JSON for programmatic parsing
  console.log('\n--- JSON Report ---');
  console.log(JSON.stringify(report, null, 2));
}).catch(console.error);
