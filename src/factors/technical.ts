/**
 * Technical Factors
 * Chart-based technical indicators
 */

import type { TechnicalFactors, PriceData } from './types';
import { sma, ema, stdDev, trueRange } from './utils';

/**
 * Calculate all technical factors
 */
export function calculateTechnicalFactors(prices: PriceData[]): TechnicalFactors {
  const closes = prices.map((p) => p.close);
  const highs = prices.map((p) => p.high);
  const lows = prices.map((p) => p.low);
  const volumes = prices.map((p) => p.volume);

  const currentPrice = closes[closes.length - 1];

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);

  const bollinger = calculateBollingerBands(closes, 20, 2);

  return {
    sma_20: sma20,
    sma_50: sma50,
    sma_200: sma200,
    ema_12: ema(closes, 12),
    ema_26: ema(closes, 26),
    price_to_sma_20: sma20 ? ((currentPrice / sma20) - 1) * 100 : null,
    price_to_sma_50: sma50 ? ((currentPrice / sma50) - 1) * 100 : null,
    price_to_sma_200: sma200 ? ((currentPrice / sma200) - 1) * 100 : null,
    bollinger_upper: bollinger.upper,
    bollinger_lower: bollinger.lower,
    bollinger_width: bollinger.width,
    bollinger_pct_b: bollinger.percentB,
    atr_14: calculateATR(highs, lows, closes, 14),
    adx_14: calculateADX(highs, lows, closes, 14),
    obv: calculateOBV(closes, volumes),
    vwap: calculateVWAP(prices),
  };
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  prices: number[],
  period = 20,
  stdDevMultiplier = 2
): {
  upper: number | null;
  middle: number | null;
  lower: number | null;
  width: number | null;
  percentB: number | null;
} {
  if (prices.length < period) {
    return { upper: null, middle: null, lower: null, width: null, percentB: null };
  }

  const recentPrices = prices.slice(-period);
  const middle = sma(recentPrices, period)!;
  const std = stdDev(recentPrices);

  const upper = middle + stdDevMultiplier * std;
  const lower = middle - stdDevMultiplier * std;
  const width = ((upper - lower) / middle) * 100;

  const currentPrice = prices[prices.length - 1];
  const percentB = upper !== lower ? ((currentPrice - lower) / (upper - lower)) * 100 : 50;

  return { upper, middle, lower, width, percentB };
}

/**
 * Average True Range (ATR)
 */
export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number | null {
  if (highs.length < period + 1) return null;

  const trueRanges: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    trueRanges.push(trueRange(highs[i], lows[i], closes[i - 1]));
  }

  // Wilder's smoothed average
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return atr;
}

/**
 * Average Directional Index (ADX)
 */
export function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number | null {
  if (highs.length < period * 2) return null;

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];

    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
    tr.push(trueRange(highs[i], lows[i], closes[i - 1]));
  }

  // Smooth the values
  const smoothedTR = smoothWilder(tr, period);
  const smoothedPlusDM = smoothWilder(plusDM, period);
  const smoothedMinusDM = smoothWilder(minusDM, period);

  if (!smoothedTR.length) return null;

  // Calculate DI
  const plusDI = smoothedPlusDM.map((dm, i) =>
    smoothedTR[i] !== 0 ? (dm / smoothedTR[i]) * 100 : 0
  );
  const minusDI = smoothedMinusDM.map((dm, i) =>
    smoothedTR[i] !== 0 ? (dm / smoothedTR[i]) * 100 : 0
  );

  // Calculate DX
  const dx = plusDI.map((pdi, i) => {
    const sum = pdi + minusDI[i];
    return sum !== 0 ? (Math.abs(pdi - minusDI[i]) / sum) * 100 : 0;
  });

  // Smooth DX to get ADX
  const adx = smoothWilder(dx, period);

  return adx.length > 0 ? adx[adx.length - 1] : null;
}

/**
 * Wilder's smoothing
 */
function smoothWilder(values: number[], period: number): number[] {
  if (values.length < period) return [];

  const result: number[] = [];
  let smoothed = values.slice(0, period).reduce((a, b) => a + b, 0);
  result.push(smoothed);

  for (let i = period; i < values.length; i++) {
    smoothed = smoothed - smoothed / period + values[i];
    result.push(smoothed);
  }

  return result;
}

/**
 * On-Balance Volume (OBV)
 */
export function calculateOBV(closes: number[], volumes: number[]): number | null {
  if (closes.length < 2 || closes.length !== volumes.length) return null;

  let obv = 0;

  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obv += volumes[i];
    } else if (closes[i] < closes[i - 1]) {
      obv -= volumes[i];
    }
    // If equal, OBV stays the same
  }

  return obv;
}

/**
 * Volume Weighted Average Price (VWAP)
 */
export function calculateVWAP(prices: PriceData[]): number | null {
  if (prices.length === 0) return null;

  let cumulativeTPV = 0; // Typical Price * Volume
  let cumulativeVolume = 0;

  for (const bar of prices) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativeTPV += typicalPrice * bar.volume;
    cumulativeVolume += bar.volume;
  }

  if (cumulativeVolume === 0) return null;
  return cumulativeTPV / cumulativeVolume;
}

/**
 * Stochastic Oscillator
 */
export function calculateStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): { k: number | null; d: number | null } {
  if (highs.length < period) return { k: null, d: null };

  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);

  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);

  const currentClose = closes[closes.length - 1];

  if (highestHigh === lowestLow) return { k: 50, d: null };

  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

  // %D is 3-period SMA of %K (would need historical K values)
  return { k, d: null };
}
