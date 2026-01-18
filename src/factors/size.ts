/**
 * Size Factors
 * Market capitalization and size-related metrics
 */

import type { SizeFactors, FundamentalData } from './types';

/**
 * Calculate all size factors
 */
export function calculateSizeFactors(fundamentals: FundamentalData): SizeFactors {
  return {
    market_cap: fundamentals.marketCap ?? null,
    market_cap_log: calculateLogMarketCap(fundamentals.marketCap),
    float_shares: fundamentals.floatShares ?? null,
  };
}

/**
 * Log Market Cap (for normalization)
 * Useful since market cap has extreme right skew
 */
export function calculateLogMarketCap(
  marketCap: number | undefined
): number | null {
  if (marketCap === undefined || marketCap <= 0) return null;
  return Math.log10(marketCap);
}

/**
 * Classify market cap into size category
 */
export function classifyMarketCap(marketCap: number | undefined): string {
  if (marketCap === undefined) return 'unknown';

  // Common US market thresholds
  if (marketCap >= 200_000_000_000) return 'mega'; // $200B+
  if (marketCap >= 10_000_000_000) return 'large'; // $10B+
  if (marketCap >= 2_000_000_000) return 'mid'; // $2B+
  if (marketCap >= 300_000_000) return 'small'; // $300M+
  if (marketCap >= 50_000_000) return 'micro'; // $50M+
  return 'nano'; // < $50M
}

/**
 * Float percentage: Float Shares / Shares Outstanding
 */
export function calculateFloatPercentage(
  floatShares: number | undefined,
  sharesOutstanding: number | undefined
): number | null {
  if (
    floatShares === undefined ||
    sharesOutstanding === undefined ||
    sharesOutstanding <= 0
  ) {
    return null;
  }
  return (floatShares / sharesOutstanding) * 100;
}
