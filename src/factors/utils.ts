/**
 * Factor Calculation Utilities
 * Common mathematical functions for factor analysis
 */

/** Calculate simple moving average */
export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

/** Calculate exponential moving average */
export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;

  const multiplier = 2 / (period + 1);

  // Start with SMA for first value
  let emaValue = sma(values.slice(0, period), period);
  if (emaValue === null) return null;

  // Calculate EMA for remaining values
  for (let i = period; i < values.length; i++) {
    emaValue = (values[i] - emaValue) * multiplier + emaValue;
  }

  return emaValue;
}

/** Calculate standard deviation */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

/** Calculate returns from prices */
export function returns(prices: number[]): number[] {
  const result: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    result.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return result;
}

/** Calculate log returns */
export function logReturns(prices: number[]): number[] {
  const result: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    result.push(Math.log(prices[i] / prices[i - 1]));
  }
  return result;
}

/** Calculate covariance between two arrays */
export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const meanX = x.reduce((sum, v) => sum + v, 0) / x.length;
  const meanY = y.reduce((sum, v) => sum + v, 0) / y.length;

  let cov = 0;
  for (let i = 0; i < x.length; i++) {
    cov += (x[i] - meanX) * (y[i] - meanY);
  }

  return cov / (x.length - 1);
}

/** Calculate Pearson correlation */
export function correlation(x: number[], y: number[]): number {
  const cov = covariance(x, y);
  const stdX = stdDev(x);
  const stdY = stdDev(y);

  if (stdX === 0 || stdY === 0) return 0;
  return cov / (stdX * stdY);
}

/** Calculate percentile rank */
export function percentileRank(value: number, values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = sorted.findIndex((v) => v >= value);
  if (rank === -1) return 100;
  return (rank / sorted.length) * 100;
}

/** Calculate z-score */
export function zscore(value: number, values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const std = stdDev(values);
  if (std === 0) return 0;
  return (value - mean) / std;
}

/** Calculate min-max normalization (0-1 scale) */
export function minMaxNorm(value: number, values: number[]): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

/** Calculate max drawdown from prices */
export function maxDrawdown(prices: number[]): number {
  if (prices.length < 2) return 0;

  let maxPrice = prices[0];
  let maxDD = 0;

  for (const price of prices) {
    if (price > maxPrice) {
      maxPrice = price;
    }
    const drawdown = (maxPrice - price) / maxPrice;
    if (drawdown > maxDD) {
      maxDD = drawdown;
    }
  }

  return maxDD;
}

/** Calculate downside deviation (semi-deviation below threshold) */
export function downsideDeviation(returns: number[], threshold = 0): number {
  const downsideReturns = returns.filter((r) => r < threshold);
  if (downsideReturns.length < 2) return 0;

  const squaredDiffs = downsideReturns.map((r) => Math.pow(r - threshold, 2));
  const meanSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / downsideReturns.length;

  return Math.sqrt(meanSquaredDiff);
}

/** Calculate true range for ATR */
export function trueRange(
  high: number,
  low: number,
  prevClose: number
): number {
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

/** Get rolling window of values */
export function rollingWindow<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = size - 1; i < array.length; i++) {
    result.push(array.slice(i - size + 1, i + 1));
  }
  return result;
}

/** Safe division - returns null on divide by zero */
export function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined
): number | null {
  if (numerator == null || denominator == null || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

/** Annualize return based on period (daily -> annual) */
export function annualize(value: number, tradingDays = 252): number {
  return value * Math.sqrt(tradingDays);
}
