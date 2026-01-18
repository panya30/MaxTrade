/**
 * Quality Factors
 * Profitability and financial health metrics
 */

import type { QualityFactors, FundamentalData } from './types';
import { safeDivide } from './utils';

/**
 * Calculate all quality factors
 */
export function calculateQualityFactors(
  fundamentals: FundamentalData
): QualityFactors {
  return {
    roe: calculateROE(fundamentals.netIncome, fundamentals.totalEquity),
    roa: calculateROA(fundamentals.netIncome, fundamentals.totalAssets),
    roic: calculateROIC(
      fundamentals.netIncome,
      fundamentals.investedCapital
    ),
    debt_to_equity: calculateDebtToEquity(
      fundamentals.totalDebt,
      fundamentals.totalEquity
    ),
    current_ratio: calculateCurrentRatio(
      fundamentals.currentAssets,
      fundamentals.currentLiabilities
    ),
    profit_margin: calculateProfitMargin(
      fundamentals.netIncome,
      fundamentals.revenue
    ),
    gross_margin: calculateGrossMargin(
      fundamentals.grossProfit,
      fundamentals.revenue
    ),
  };
}

/**
 * ROE (Return on Equity): Net Income / Shareholders' Equity
 * Higher is generally better
 */
export function calculateROE(
  netIncome: number | undefined,
  totalEquity: number | undefined
): number | null {
  if (netIncome === undefined || totalEquity === undefined || totalEquity <= 0) {
    return null;
  }
  return (netIncome / totalEquity) * 100;
}

/**
 * ROA (Return on Assets): Net Income / Total Assets
 * Higher is generally better
 */
export function calculateROA(
  netIncome: number | undefined,
  totalAssets: number | undefined
): number | null {
  if (netIncome === undefined || totalAssets === undefined || totalAssets <= 0) {
    return null;
  }
  return (netIncome / totalAssets) * 100;
}

/**
 * ROIC (Return on Invested Capital): Net Income / Invested Capital
 * Higher is generally better - measures efficiency of capital allocation
 */
export function calculateROIC(
  netIncome: number | undefined,
  investedCapital: number | undefined
): number | null {
  if (
    netIncome === undefined ||
    investedCapital === undefined ||
    investedCapital <= 0
  ) {
    return null;
  }
  return (netIncome / investedCapital) * 100;
}

/**
 * Debt-to-Equity Ratio: Total Debt / Total Equity
 * Lower is generally better (less leveraged)
 */
export function calculateDebtToEquity(
  totalDebt: number | undefined,
  totalEquity: number | undefined
): number | null {
  if (
    totalDebt === undefined ||
    totalEquity === undefined ||
    totalEquity <= 0
  ) {
    return null;
  }
  return totalDebt / totalEquity;
}

/**
 * Current Ratio: Current Assets / Current Liabilities
 * Higher is generally better (more liquid), but too high may be inefficient
 */
export function calculateCurrentRatio(
  currentAssets: number | undefined,
  currentLiabilities: number | undefined
): number | null {
  if (
    currentAssets === undefined ||
    currentLiabilities === undefined ||
    currentLiabilities <= 0
  ) {
    return null;
  }
  return currentAssets / currentLiabilities;
}

/**
 * Net Profit Margin: Net Income / Revenue
 * Higher is generally better
 */
export function calculateProfitMargin(
  netIncome: number | undefined,
  revenue: number | undefined
): number | null {
  if (netIncome === undefined || revenue === undefined || revenue <= 0) {
    return null;
  }
  return (netIncome / revenue) * 100;
}

/**
 * Gross Margin: Gross Profit / Revenue
 * Higher is generally better
 */
export function calculateGrossMargin(
  grossProfit: number | undefined,
  revenue: number | undefined
): number | null {
  if (grossProfit === undefined || revenue === undefined || revenue <= 0) {
    return null;
  }
  return (grossProfit / revenue) * 100;
}

/**
 * Operating Margin: Operating Income / Revenue
 * Higher is generally better
 */
export function calculateOperatingMargin(
  operatingIncome: number | undefined,
  revenue: number | undefined
): number | null {
  if (
    operatingIncome === undefined ||
    revenue === undefined ||
    revenue <= 0
  ) {
    return null;
  }
  return (operatingIncome / revenue) * 100;
}

/**
 * Interest Coverage Ratio: EBIT / Interest Expense
 * Higher is generally better (ability to pay interest)
 */
export function calculateInterestCoverage(
  ebit: number | undefined,
  interestExpense: number | undefined
): number | null {
  if (
    ebit === undefined ||
    interestExpense === undefined ||
    interestExpense <= 0
  ) {
    return null;
  }
  return ebit / interestExpense;
}

/**
 * Asset Turnover: Revenue / Total Assets
 * Higher indicates efficient use of assets
 */
export function calculateAssetTurnover(
  revenue: number | undefined,
  totalAssets: number | undefined
): number | null {
  if (revenue === undefined || totalAssets === undefined || totalAssets <= 0) {
    return null;
  }
  return revenue / totalAssets;
}
