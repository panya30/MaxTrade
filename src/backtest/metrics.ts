/**
 * Performance Metrics Calculator
 * Comprehensive backtest performance analysis
 */

import type {
  PerformanceMetrics,
  BenchmarkComparison,
  Trade,
  EquityPoint,
  MonthlyReturn,
} from './types';

/** Calculate all performance metrics */
export function calculateMetrics(
  equityCurve: EquityPoint[],
  trades: Trade[],
  initialCapital: number,
  riskFreeRate = 0.02
): PerformanceMetrics {
  if (equityCurve.length === 0) {
    return createEmptyMetrics();
  }

  const finalValue = equityCurve[equityCurve.length - 1].equity;
  const startDate = equityCurve[0].date;
  const endDate = equityCurve[equityCurve.length - 1].date;
  const tradingDays = equityCurve.length;

  // Returns
  const totalReturn = finalValue - initialCapital;
  const totalReturnPercent = (totalReturn / initialCapital) * 100;

  const years = tradingDays / 252;
  const cagr = years > 0 ? (Math.pow(finalValue / initialCapital, 1 / years) - 1) * 100 : 0;

  // Daily returns for volatility calculation
  const dailyReturns = equityCurve
    .slice(1)
    .map((point, i) => (point.equity - equityCurve[i].equity) / equityCurve[i].equity);

  const volatility = calculateVolatility(dailyReturns) * 100;

  // Risk-adjusted returns
  const sharpeRatio = calculateSharpeRatio(dailyReturns, riskFreeRate);
  const sortinoRatio = calculateSortinoRatio(dailyReturns, riskFreeRate);

  // Drawdown analysis
  const { maxDrawdown, maxDrawdownDuration, avgDrawdown } = calculateDrawdownMetrics(equityCurve);

  const calmarRatio = maxDrawdown !== 0 ? cagr / maxDrawdown : 0;

  // Trade statistics
  const tradeStats = calculateTradeStats(trades);

  return {
    totalReturn,
    totalReturnPercent,
    annualizedReturn: cagr,
    cagr,
    volatility,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    maxDrawdown,
    maxDrawdownDuration,
    avgDrawdown,
    ...tradeStats,
    tradingDays,
    startDate,
    endDate,
    finalValue,
  };
}

/** Calculate annualized volatility from daily returns */
function calculateVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;

  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const squaredDiffs = dailyReturns.map((r) => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (dailyReturns.length - 1);

  return Math.sqrt(variance * 252); // Annualize
}

/** Calculate Sharpe Ratio */
function calculateSharpeRatio(dailyReturns: number[], annualRiskFreeRate: number): number {
  if (dailyReturns.length < 2) return 0;

  const dailyRiskFree = annualRiskFreeRate / 252;
  const excessReturns = dailyReturns.map((r) => r - dailyRiskFree);

  const avgExcessReturn = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
  const volatility = calculateVolatility(excessReturns);

  if (volatility === 0) return 0;

  return (avgExcessReturn * 252) / volatility;
}

/** Calculate Sortino Ratio */
function calculateSortinoRatio(dailyReturns: number[], annualRiskFreeRate: number): number {
  if (dailyReturns.length < 2) return 0;

  const dailyRiskFree = annualRiskFreeRate / 252;
  const excessReturns = dailyReturns.map((r) => r - dailyRiskFree);

  const avgExcessReturn = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;

  // Downside deviation
  const negativeReturns = excessReturns.filter((r) => r < 0);
  if (negativeReturns.length < 2) return avgExcessReturn > 0 ? Infinity : 0;

  const downsideSquared = negativeReturns.map((r) => r * r);
  const downsideVariance = downsideSquared.reduce((a, b) => a + b, 0) / negativeReturns.length;
  const downsideDeviation = Math.sqrt(downsideVariance * 252);

  if (downsideDeviation === 0) return 0;

  return (avgExcessReturn * 252) / downsideDeviation;
}

/** Calculate drawdown metrics */
function calculateDrawdownMetrics(equityCurve: EquityPoint[]): {
  maxDrawdown: number;
  maxDrawdownDuration: number;
  avgDrawdown: number;
} {
  if (equityCurve.length === 0) {
    return { maxDrawdown: 0, maxDrawdownDuration: 0, avgDrawdown: 0 };
  }

  let peak = equityCurve[0].equity;
  let maxDrawdown = 0;
  let currentDrawdownStart = 0;
  let maxDrawdownDuration = 0;
  let drawdowns: number[] = [];

  for (let i = 0; i < equityCurve.length; i++) {
    const equity = equityCurve[i].equity;

    if (equity > peak) {
      // New peak - record drawdown duration
      if (currentDrawdownStart > 0) {
        const duration = i - currentDrawdownStart;
        maxDrawdownDuration = Math.max(maxDrawdownDuration, duration);
        currentDrawdownStart = 0;
      }
      peak = equity;
    } else {
      const drawdown = ((peak - equity) / peak) * 100;
      drawdowns.push(drawdown);

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      if (currentDrawdownStart === 0) {
        currentDrawdownStart = i;
      }
    }
  }

  // Check final drawdown duration
  if (currentDrawdownStart > 0) {
    maxDrawdownDuration = Math.max(
      maxDrawdownDuration,
      equityCurve.length - currentDrawdownStart
    );
  }

  const avgDrawdown = drawdowns.length > 0
    ? drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length
    : 0;

  return { maxDrawdown, maxDrawdownDuration, avgDrawdown };
}

/** Calculate trade statistics */
function calculateTradeStats(trades: Trade[]): {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgWinLossRatio: number;
  largestWin: number;
  largestLoss: number;
  avgHoldingPeriod: number;
} {
  // Only count sell trades (completed round trips)
  const closedTrades = trades.filter((t) => t.side === 'sell' && t.pnl !== undefined);

  if (closedTrades.length === 0) {
    return {
      totalTrades: trades.length,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      avgWinLossRatio: 0,
      largestWin: 0,
      largestLoss: 0,
      avgHoldingPeriod: 0,
    };
  }

  const winningTrades = closedTrades.filter((t) => t.pnl! > 0);
  const losingTrades = closedTrades.filter((t) => t.pnl! <= 0);

  const totalWin = winningTrades.reduce((sum, t) => sum + t.pnl!, 0);
  const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl!, 0));

  const avgWin = winningTrades.length > 0 ? totalWin / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;

  const largestWin = winningTrades.length > 0
    ? Math.max(...winningTrades.map((t) => t.pnl!))
    : 0;
  const largestLoss = losingTrades.length > 0
    ? Math.abs(Math.min(...losingTrades.map((t) => t.pnl!)))
    : 0;

  const avgHoldingPeriod = closedTrades
    .filter((t) => t.holdingPeriodDays !== undefined)
    .reduce((sum, t) => sum + t.holdingPeriodDays!, 0) / closedTrades.length || 0;

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: (winningTrades.length / closedTrades.length) * 100,
    profitFactor: totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0,
    avgWin,
    avgLoss,
    avgWinLossRatio: avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0,
    largestWin,
    largestLoss,
    avgHoldingPeriod,
  };
}

/** Calculate benchmark comparison */
export function calculateBenchmarkComparison(
  equityCurve: EquityPoint[],
  benchmarkPrices: number[],
  riskFreeRate = 0.02
): BenchmarkComparison {
  if (equityCurve.length < 2 || benchmarkPrices.length < 2) {
    return createEmptyBenchmark();
  }

  // Align lengths
  const minLen = Math.min(equityCurve.length, benchmarkPrices.length);
  const equity = equityCurve.slice(0, minLen);
  const benchmark = benchmarkPrices.slice(0, minLen);

  // Strategy returns
  const strategyReturns = equity
    .slice(1)
    .map((point, i) => (point.equity - equity[i].equity) / equity[i].equity);

  // Benchmark returns
  const benchmarkReturns = benchmark
    .slice(1)
    .map((price, i) => (price - benchmark[i]) / benchmark[i]);

  // Benchmark metrics
  const benchmarkReturn = ((benchmark[benchmark.length - 1] / benchmark[0]) - 1) * 100;
  const benchmarkVolatility = calculateVolatility(benchmarkReturns) * 100;
  const benchmarkSharpe = calculateSharpeRatio(benchmarkReturns, riskFreeRate);

  // Benchmark max drawdown
  let peak = benchmark[0];
  let maxDD = 0;
  for (const price of benchmark) {
    if (price > peak) peak = price;
    const dd = (peak - price) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  const benchmarkMaxDrawdown = maxDD * 100;

  // Correlation and Beta
  const correlation = calculateCorrelation(strategyReturns, benchmarkReturns);
  const beta = calculateBeta(strategyReturns, benchmarkReturns);

  // Alpha (Jensen's Alpha)
  const avgStrategyReturn = strategyReturns.reduce((a, b) => a + b, 0) / strategyReturns.length * 252;
  const avgBenchmarkReturn = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length * 252;
  const alpha = avgStrategyReturn - (riskFreeRate + beta * (avgBenchmarkReturn - riskFreeRate));

  // Tracking error
  const excessReturns = strategyReturns.map((r, i) => r - benchmarkReturns[i]);
  const trackingError = calculateVolatility(excessReturns) * 100;

  // Information ratio
  const avgExcess = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length * 252 * 100;
  const informationRatio = trackingError > 0 ? avgExcess / trackingError : 0;

  // Excess return
  const strategyReturn = ((equity[equity.length - 1].equity / equity[0].equity) - 1) * 100;
  const excessReturn = strategyReturn - benchmarkReturn;

  return {
    benchmarkReturn,
    benchmarkVolatility,
    benchmarkSharpe,
    benchmarkMaxDrawdown,
    alpha: alpha * 100,
    beta,
    correlation,
    informationRatio,
    trackingError,
    excessReturn,
  };
}

/** Calculate Pearson correlation */
function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const denom = Math.sqrt(varX * varY);
  return denom > 0 ? cov / denom : 0;
}

/** Calculate Beta */
function calculateBeta(strategyReturns: number[], benchmarkReturns: number[]): number {
  if (strategyReturns.length !== benchmarkReturns.length || strategyReturns.length < 2) {
    return 1;
  }

  const n = strategyReturns.length;
  const meanStrategy = strategyReturns.reduce((a, b) => a + b, 0) / n;
  const meanBenchmark = benchmarkReturns.reduce((a, b) => a + b, 0) / n;

  let cov = 0;
  let varBenchmark = 0;

  for (let i = 0; i < n; i++) {
    const ds = strategyReturns[i] - meanStrategy;
    const db = benchmarkReturns[i] - meanBenchmark;
    cov += ds * db;
    varBenchmark += db * db;
  }

  return varBenchmark > 0 ? cov / varBenchmark : 1;
}

/** Generate monthly returns table */
export function calculateMonthlyReturns(equityCurve: EquityPoint[]): MonthlyReturn[] {
  if (equityCurve.length === 0) return [];

  const monthlyReturns: MonthlyReturn[] = [];
  const monthlyData: Map<string, { start: number; end: number }> = new Map();

  for (const point of equityCurve) {
    const date = new Date(point.date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;

    if (!monthlyData.has(key)) {
      monthlyData.set(key, { start: point.equity, end: point.equity });
    } else {
      monthlyData.get(key)!.end = point.equity;
    }
  }

  for (const [key, data] of monthlyData) {
    const [year, month] = key.split('-').map(Number);
    const ret = ((data.end / data.start) - 1) * 100;
    monthlyReturns.push({ year, month, return: ret });
  }

  return monthlyReturns.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
}

/** Create empty metrics object */
function createEmptyMetrics(): PerformanceMetrics {
  return {
    totalReturn: 0,
    totalReturnPercent: 0,
    annualizedReturn: 0,
    cagr: 0,
    volatility: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    calmarRatio: 0,
    maxDrawdown: 0,
    maxDrawdownDuration: 0,
    avgDrawdown: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    profitFactor: 0,
    avgWin: 0,
    avgLoss: 0,
    avgWinLossRatio: 0,
    largestWin: 0,
    largestLoss: 0,
    avgHoldingPeriod: 0,
    tradingDays: 0,
    startDate: 0,
    endDate: 0,
    finalValue: 0,
  };
}

/** Create empty benchmark comparison */
function createEmptyBenchmark(): BenchmarkComparison {
  return {
    benchmarkReturn: 0,
    benchmarkVolatility: 0,
    benchmarkSharpe: 0,
    benchmarkMaxDrawdown: 0,
    alpha: 0,
    beta: 1,
    correlation: 0,
    informationRatio: 0,
    trackingError: 0,
    excessReturn: 0,
  };
}
