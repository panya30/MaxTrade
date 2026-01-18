/**
 * Volatility Factors
 * Risk and volatility metrics
 */

import type { VolatilityFactors, PriceData } from './types';
import {
  stdDev,
  returns,
  covariance,
  maxDrawdown,
  downsideDeviation,
  annualize,
} from './utils';

/**
 * Calculate all volatility factors
 */
export function calculateVolatilityFactors(
  prices: PriceData[],
  benchmark?: PriceData[],
  riskFreeRate = 0.02
): VolatilityFactors {
  const closes = prices.map((p) => p.close);
  const dailyReturns = returns(closes);

  return {
    volatility_20d: calculateHistoricalVolatility(dailyReturns, 20),
    volatility_60d: calculateHistoricalVolatility(dailyReturns, 60),
    beta: benchmark ? calculateBeta(dailyReturns, returns(benchmark.map((p) => p.close))) : null,
    sharpe_ratio: calculateSharpeRatio(dailyReturns, riskFreeRate),
    max_drawdown: maxDrawdown(closes) * 100,
    downside_deviation: calculateDownsideDeviation(dailyReturns),
  };
}

/**
 * Historical volatility (annualized standard deviation of returns)
 */
export function calculateHistoricalVolatility(
  dailyReturns: number[],
  period: number
): number | null {
  if (dailyReturns.length < period) return null;

  const recentReturns = dailyReturns.slice(-period);
  const dailyVol = stdDev(recentReturns);

  // Annualize (252 trading days)
  return annualize(dailyVol) * 100;
}

/**
 * Beta: covariance(asset, benchmark) / variance(benchmark)
 */
export function calculateBeta(
  assetReturns: number[],
  benchmarkReturns: number[]
): number | null {
  // Align lengths
  const minLen = Math.min(assetReturns.length, benchmarkReturns.length);
  if (minLen < 20) return null;

  const asset = assetReturns.slice(-minLen);
  const benchmark = benchmarkReturns.slice(-minLen);

  const cov = covariance(asset, benchmark);
  const benchmarkVariance = Math.pow(stdDev(benchmark), 2);

  if (benchmarkVariance === 0) return null;
  return cov / benchmarkVariance;
}

/**
 * Sharpe Ratio: (return - risk_free_rate) / volatility
 */
export function calculateSharpeRatio(
  dailyReturns: number[],
  annualRiskFreeRate = 0.02
): number | null {
  if (dailyReturns.length < 20) return null;

  const dailyRiskFree = annualRiskFreeRate / 252;
  const excessReturns = dailyReturns.map((r) => r - dailyRiskFree);

  const avgExcessReturn = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
  const volatility = stdDev(excessReturns);

  if (volatility === 0) return null;

  // Annualize
  return (avgExcessReturn * 252) / annualize(volatility);
}

/**
 * Downside deviation (annualized)
 */
export function calculateDownsideDeviation(
  dailyReturns: number[],
  threshold = 0
): number | null {
  if (dailyReturns.length < 20) return null;

  const dd = downsideDeviation(dailyReturns, threshold);
  return annualize(dd) * 100;
}

/**
 * Sortino Ratio: (return - MAR) / downside_deviation
 */
export function calculateSortinoRatio(
  dailyReturns: number[],
  annualMAR = 0
): number | null {
  if (dailyReturns.length < 20) return null;

  const dailyMAR = annualMAR / 252;
  const excessReturns = dailyReturns.map((r) => r - dailyMAR);

  const avgExcessReturn = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
  const dd = downsideDeviation(dailyReturns, dailyMAR);

  if (dd === 0) return null;

  // Annualize
  return (avgExcessReturn * 252) / annualize(dd);
}

/**
 * Calmar Ratio: annualized_return / max_drawdown
 */
export function calculateCalmarRatio(
  prices: number[],
  period = 252
): number | null {
  if (prices.length < period) return null;

  const recentPrices = prices.slice(-period);
  const totalReturn = (recentPrices[recentPrices.length - 1] / recentPrices[0]) - 1;
  const mdd = maxDrawdown(recentPrices);

  if (mdd === 0) return null;
  return totalReturn / mdd;
}
