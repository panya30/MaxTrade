/**
 * Momentum Factors
 * Price and volume momentum indicators
 */

import type { MomentumFactors, PriceData } from './types';
import { sma, ema, returns } from './utils';

/**
 * Calculate all momentum factors
 */
export function calculateMomentumFactors(
  prices: PriceData[],
  periods = { short: 20, medium: 60, long: 252 }
): MomentumFactors {
  const closes = prices.map((p) => p.close);
  const volumes = prices.map((p) => p.volume);

  return {
    momentum_20d: calculatePriceMomentum(closes, periods.short),
    momentum_60d: calculatePriceMomentum(closes, periods.medium),
    momentum_252d: calculatePriceMomentum(closes, periods.long),
    momentum_accel_20d: calculateMomentumAcceleration(closes, periods.short),
    momentum_accel_60d: calculateMomentumAcceleration(closes, periods.medium),
    volume_momentum_20d: calculateVolumeMomentum(volumes, periods.short),
    rsi_14: calculateRSI(closes, 14),
    ...calculateMACD(closes),
  };
}

/**
 * Price momentum: (current_price / past_price - 1) * 100
 */
export function calculatePriceMomentum(
  prices: number[],
  period: number
): number | null {
  if (prices.length < period + 1) return null;

  const currentPrice = prices[prices.length - 1];
  const pastPrice = prices[prices.length - 1 - period];

  if (pastPrice === 0) return null;
  return ((currentPrice / pastPrice) - 1) * 100;
}

/**
 * Momentum acceleration: recent momentum - older momentum
 */
export function calculateMomentumAcceleration(
  prices: number[],
  period: number
): number | null {
  if (prices.length < period * 2 + 1) return null;

  const currentPrice = prices[prices.length - 1];
  const midPrice = prices[prices.length - 1 - period];
  const oldPrice = prices[prices.length - 1 - period * 2];

  if (midPrice === 0 || oldPrice === 0) return null;

  const recentMomentum = (currentPrice / midPrice - 1) * 100;
  const olderMomentum = (midPrice / oldPrice - 1) * 100;

  return recentMomentum - olderMomentum;
}

/**
 * Volume momentum: current volume vs average volume
 */
export function calculateVolumeMomentum(
  volumes: number[],
  period: number
): number | null {
  if (volumes.length < period) return null;

  const avgVolume = sma(volumes.slice(0, -1), period - 1);
  if (avgVolume === null || avgVolume === 0) return null;

  const currentVolume = volumes[volumes.length - 1];
  return ((currentVolume / avgVolume) - 1) * 100;
}

/**
 * RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;

  const changes = returns(prices).map((r) => r * prices[0]); // Convert to price changes

  // Use actual price differences for more accuracy
  const diffs: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    diffs.push(prices[i] - prices[i - 1]);
  }

  if (diffs.length < period) return null;

  // Calculate initial averages
  const gains: number[] = [];
  const losses: number[] = [];

  for (const diff of diffs) {
    if (diff > 0) {
      gains.push(diff);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(Math.abs(diff));
    }
  }

  // Wilder's smoothed averages
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macd: number | null; macd_signal: number | null; macd_histogram: number | null } {
  const fastEMA = ema(prices, fastPeriod);
  const slowEMA = ema(prices, slowPeriod);

  if (fastEMA === null || slowEMA === null) {
    return { macd: null, macd_signal: null, macd_histogram: null };
  }

  const macdLine = fastEMA - slowEMA;

  // Calculate MACD history for signal line
  const macdHistory: number[] = [];
  for (let i = slowPeriod - 1; i < prices.length; i++) {
    const slice = prices.slice(0, i + 1);
    const fast = ema(slice, fastPeriod);
    const slow = ema(slice, slowPeriod);
    if (fast !== null && slow !== null) {
      macdHistory.push(fast - slow);
    }
  }

  const signalLine = ema(macdHistory, signalPeriod);
  const histogram = signalLine !== null ? macdLine - signalLine : null;

  return {
    macd: macdLine,
    macd_signal: signalLine,
    macd_histogram: histogram,
  };
}
