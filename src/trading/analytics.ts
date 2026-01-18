/**
 * Portfolio Analytics
 * Calculate performance metrics for portfolios
 */

import type { Trade, PortfolioAnalytics } from './types';
import { Portfolio } from './portfolio';

/**
 * Calculate portfolio analytics from trade history
 */
export function calculateAnalytics(
  trades: Trade[],
  riskFreeRate = 0.02
): PortfolioAnalytics {
  if (trades.length === 0) {
    return {
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
    };
  }

  // Filter trades with P&L (sell trades)
  const tradesWithPnl = trades.filter((t) => t.pnl !== undefined);
  const pnls = tradesWithPnl.map((t) => t.pnl!);

  // Calculate wins and losses
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);

  const winningTrades = wins.length;
  const losingTrades = losses.length;
  const totalClosedTrades = winningTrades + losingTrades;

  // Win rate
  const winRate = totalClosedTrades > 0 ? (winningTrades / totalClosedTrades) * 100 : 0;

  // Average win/loss
  const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss =
    losses.length > 0
      ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length)
      : 0;

  // Profit factor
  const totalWins = wins.reduce((a, b) => a + b, 0);
  const totalLosses = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  // Calculate returns for Sharpe/Sortino
  const returns = calculateDailyReturns(trades);

  // Sharpe ratio
  const sharpeRatio = calculateSharpeRatio(returns, riskFreeRate);

  // Sortino ratio
  const sortinoRatio = calculateSortinoRatio(returns, riskFreeRate);

  // Max drawdown from cumulative P&L
  const maxDrawdown = calculateMaxDrawdownFromPnl(pnls);

  return {
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    totalTrades: trades.length,
    winningTrades,
    losingTrades,
  };
}

/**
 * Calculate daily returns from trades
 */
function calculateDailyReturns(trades: Trade[]): number[] {
  if (trades.length === 0) return [];

  // Group trades by day
  const dailyPnl = new Map<string, number>();
  for (const trade of trades) {
    if (trade.pnl === undefined) continue;
    const date = new Date(trade.timestamp).toDateString();
    dailyPnl.set(date, (dailyPnl.get(date) ?? 0) + trade.pnl);
  }

  // Convert to array of returns
  const pnls = Array.from(dailyPnl.values());
  if (pnls.length === 0) return [];

  // Assume base value of 100000 for return calculation
  const baseValue = 100000;
  return pnls.map((pnl) => pnl / baseValue);
}

/**
 * Calculate Sharpe ratio
 */
function calculateSharpeRatio(returns: number[], riskFreeRate: number): number {
  if (returns.length < 2) return 0;

  const dailyRf = riskFreeRate / 252; // Annualized to daily
  const excessReturns = returns.map((r) => r - dailyRf);

  const mean = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
  const variance =
    excessReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
    (excessReturns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Annualize
  return (mean / stdDev) * Math.sqrt(252);
}

/**
 * Calculate Sortino ratio (only considers downside deviation)
 */
function calculateSortinoRatio(returns: number[], riskFreeRate: number): number {
  if (returns.length < 2) return 0;

  const dailyRf = riskFreeRate / 252;
  const excessReturns = returns.map((r) => r - dailyRf);

  const mean = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;

  // Only negative returns for downside deviation
  const negativeReturns = excessReturns.filter((r) => r < 0);
  if (negativeReturns.length === 0) return mean > 0 ? Infinity : 0;

  const downsideVariance =
    negativeReturns.reduce((sum, r) => sum + r ** 2, 0) / negativeReturns.length;
  const downsideDev = Math.sqrt(downsideVariance);

  if (downsideDev === 0) return 0;

  // Annualize
  return (mean / downsideDev) * Math.sqrt(252);
}

/**
 * Calculate max drawdown from P&L series
 */
function calculateMaxDrawdownFromPnl(pnls: number[]): number {
  if (pnls.length === 0) return 0;

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const pnl of pnls) {
    cumulative += pnl;
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Return as percentage of peak
  return peak > 0 ? (maxDrawdown / peak) * 100 : 0;
}

/**
 * Calculate equity curve from trades
 */
export function calculateEquityCurve(
  initialValue: number,
  trades: Trade[]
): Array<{ timestamp: number; equity: number }> {
  const curve: Array<{ timestamp: number; equity: number }> = [
    { timestamp: trades[0]?.timestamp ?? Date.now(), equity: initialValue },
  ];

  let equity = initialValue;
  for (const trade of trades) {
    if (trade.pnl !== undefined) {
      equity += trade.pnl;
    }
    // For buy trades, just mark the timestamp
    curve.push({ timestamp: trade.timestamp, equity });
  }

  return curve;
}

/**
 * Calculate allocation breakdown
 */
export function calculateAllocation(
  portfolio: Portfolio
): Array<{ symbol: string; value: number; pct: number }> {
  const positions = portfolio.getPositions();
  const totalValue = portfolio.getTotalValue();
  const cash = portfolio.getCash();

  const allocation: Array<{ symbol: string; value: number; pct: number }> = [];

  // Add cash
  allocation.push({
    symbol: 'CASH',
    value: cash,
    pct: (cash / totalValue) * 100,
  });

  // Add positions
  for (const pos of positions) {
    allocation.push({
      symbol: pos.symbol,
      value: pos.marketValue,
      pct: (pos.marketValue / totalValue) * 100,
    });
  }

  // Sort by value descending
  allocation.sort((a, b) => b.value - a.value);

  return allocation;
}

/**
 * Calculate performance by symbol
 */
export function calculatePerformanceBySymbol(
  trades: Trade[]
): Map<string, { trades: number; pnl: number; winRate: number }> {
  const bySymbol = new Map<
    string,
    { trades: number; pnl: number; wins: number }
  >();

  for (const trade of trades) {
    const existing = bySymbol.get(trade.symbol) ?? { trades: 0, pnl: 0, wins: 0 };
    existing.trades++;
    if (trade.pnl !== undefined) {
      existing.pnl += trade.pnl;
      if (trade.pnl > 0) existing.wins++;
    }
    bySymbol.set(trade.symbol, existing);
  }

  const result = new Map<
    string,
    { trades: number; pnl: number; winRate: number }
  >();

  for (const [symbol, data] of bySymbol) {
    const sellTrades = trades.filter(
      (t) => t.symbol === symbol && t.pnl !== undefined
    ).length;
    result.set(symbol, {
      trades: data.trades,
      pnl: data.pnl,
      winRate: sellTrades > 0 ? (data.wins / sellTrades) * 100 : 0,
    });
  }

  return result;
}
