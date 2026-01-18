/**
 * Value Factors
 * Valuation metrics based on fundamental data
 */

import type { ValueFactors, FundamentalData } from './types';
import { safeDivide } from './utils';

/**
 * Calculate all value factors
 */
export function calculateValueFactors(
  currentPrice: number,
  fundamentals: FundamentalData
): ValueFactors {
  return {
    pe_ratio: calculatePERatio(currentPrice, fundamentals.eps),
    pb_ratio: calculatePBRatio(currentPrice, fundamentals.bookValuePerShare),
    ps_ratio: calculatePSRatio(currentPrice, fundamentals.salesPerShare),
    dividend_yield: calculateDividendYield(fundamentals.dividendPerShare, currentPrice),
    ev_ebitda: calculateEVEBITDA(fundamentals.enterpriseValue, fundamentals.ebitda),
    price_to_fcf: calculatePriceToFCF(
      fundamentals.marketCap,
      fundamentals.freeCashFlow
    ),
  };
}

/**
 * P/E Ratio: Price / Earnings Per Share
 * Lower is generally better (more value)
 */
export function calculatePERatio(
  price: number,
  eps: number | undefined
): number | null {
  if (eps === undefined || eps <= 0) return null;
  return safeDivide(price, eps);
}

/**
 * P/B Ratio: Price / Book Value Per Share
 * Lower is generally better (more value)
 */
export function calculatePBRatio(
  price: number,
  bookValuePerShare: number | undefined
): number | null {
  if (bookValuePerShare === undefined || bookValuePerShare <= 0) return null;
  return safeDivide(price, bookValuePerShare);
}

/**
 * P/S Ratio: Price / Sales Per Share
 * Lower is generally better (more value)
 */
export function calculatePSRatio(
  price: number,
  salesPerShare: number | undefined
): number | null {
  if (salesPerShare === undefined || salesPerShare <= 0) return null;
  return safeDivide(price, salesPerShare);
}

/**
 * Dividend Yield: Annual Dividend / Price
 * Higher is generally better (more income)
 */
export function calculateDividendYield(
  dividendPerShare: number | undefined,
  price: number
): number | null {
  if (dividendPerShare === undefined || price <= 0) return null;
  return (dividendPerShare / price) * 100;
}

/**
 * EV/EBITDA: Enterprise Value / EBITDA
 * Lower is generally better (cheaper)
 */
export function calculateEVEBITDA(
  enterpriseValue: number | undefined,
  ebitda: number | undefined
): number | null {
  if (enterpriseValue === undefined || ebitda === undefined || ebitda <= 0) {
    return null;
  }
  return safeDivide(enterpriseValue, ebitda);
}

/**
 * Price to Free Cash Flow: Market Cap / Free Cash Flow
 * Lower is generally better
 */
export function calculatePriceToFCF(
  marketCap: number | undefined,
  freeCashFlow: number | undefined
): number | null {
  if (marketCap === undefined || freeCashFlow === undefined || freeCashFlow <= 0) {
    return null;
  }
  return safeDivide(marketCap, freeCashFlow);
}

/**
 * PEG Ratio: P/E / Earnings Growth Rate
 * Lower is generally better (growth at reasonable price)
 */
export function calculatePEGRatio(
  peRatio: number | null,
  earningsGrowthRate: number | undefined
): number | null {
  if (
    peRatio === null ||
    earningsGrowthRate === undefined ||
    earningsGrowthRate <= 0
  ) {
    return null;
  }
  return safeDivide(peRatio, earningsGrowthRate);
}

/**
 * Earnings Yield: EPS / Price (inverse of P/E)
 * Higher is generally better
 */
export function calculateEarningsYield(
  eps: number | undefined,
  price: number
): number | null {
  if (eps === undefined || price <= 0) return null;
  return (eps / price) * 100;
}

/**
 * Free Cash Flow Yield: FCF / Market Cap
 * Higher is generally better
 */
export function calculateFCFYield(
  freeCashFlow: number | undefined,
  marketCap: number | undefined
): number | null {
  if (
    freeCashFlow === undefined ||
    marketCap === undefined ||
    marketCap <= 0
  ) {
    return null;
  }
  return (freeCashFlow / marketCap) * 100;
}
