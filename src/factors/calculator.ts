/**
 * Factor Calculator
 * Main class for calculating all factors for a symbol
 */

import type {
  PriceData,
  FundamentalData,
  FactorData,
  FactorValue,
  AllFactors,
  FactorOptions,
  NormalizationMethod,
  CompositeWeights,
  FactorCategory,
} from './types';
import { calculateMomentumFactors } from './momentum';
import { calculateValueFactors } from './value';
import { calculateQualityFactors } from './quality';
import { calculateSizeFactors } from './size';
import { calculateVolatilityFactors } from './volatility';
import { calculateTechnicalFactors } from './technical';
import { percentileRank, zscore, minMaxNorm } from './utils';

/** Factor definitions with metadata */
export const FACTOR_DEFINITIONS: Record<
  string,
  { category: FactorCategory; higherIsBetter: boolean; description: string }
> = {
  // Momentum
  momentum_20d: { category: 'momentum', higherIsBetter: true, description: '20-day price momentum' },
  momentum_60d: { category: 'momentum', higherIsBetter: true, description: '60-day price momentum' },
  momentum_252d: { category: 'momentum', higherIsBetter: true, description: '252-day price momentum' },
  rsi_14: { category: 'momentum', higherIsBetter: false, description: '14-day RSI (50 is neutral)' },
  macd: { category: 'momentum', higherIsBetter: true, description: 'MACD line' },

  // Value
  pe_ratio: { category: 'value', higherIsBetter: false, description: 'Price to Earnings' },
  pb_ratio: { category: 'value', higherIsBetter: false, description: 'Price to Book' },
  ps_ratio: { category: 'value', higherIsBetter: false, description: 'Price to Sales' },
  dividend_yield: { category: 'value', higherIsBetter: true, description: 'Dividend yield %' },
  ev_ebitda: { category: 'value', higherIsBetter: false, description: 'EV/EBITDA' },

  // Quality
  roe: { category: 'quality', higherIsBetter: true, description: 'Return on Equity %' },
  roa: { category: 'quality', higherIsBetter: true, description: 'Return on Assets %' },
  debt_to_equity: { category: 'quality', higherIsBetter: false, description: 'Debt to Equity ratio' },
  profit_margin: { category: 'quality', higherIsBetter: true, description: 'Net profit margin %' },
  current_ratio: { category: 'quality', higherIsBetter: true, description: 'Current ratio' },

  // Size
  market_cap: { category: 'size', higherIsBetter: true, description: 'Market capitalization' },
  market_cap_log: { category: 'size', higherIsBetter: true, description: 'Log market cap' },

  // Volatility
  volatility_20d: { category: 'volatility', higherIsBetter: false, description: '20-day volatility %' },
  beta: { category: 'volatility', higherIsBetter: false, description: 'Beta vs benchmark' },
  sharpe_ratio: { category: 'volatility', higherIsBetter: true, description: 'Sharpe ratio' },
  max_drawdown: { category: 'volatility', higherIsBetter: false, description: 'Max drawdown %' },

  // Technical
  price_to_sma_20: { category: 'technical', higherIsBetter: true, description: 'Price vs 20-day SMA %' },
  price_to_sma_50: { category: 'technical', higherIsBetter: true, description: 'Price vs 50-day SMA %' },
  price_to_sma_200: { category: 'technical', higherIsBetter: true, description: 'Price vs 200-day SMA %' },
  bollinger_pct_b: { category: 'technical', higherIsBetter: false, description: 'Bollinger %B' },
  atr_14: { category: 'technical', higherIsBetter: false, description: '14-day ATR' },
  adx_14: { category: 'technical', higherIsBetter: true, description: '14-day ADX (trend strength)' },
};

export class FactorCalculator {
  private options: FactorOptions;

  constructor(options: FactorOptions = {}) {
    this.options = {
      riskFreeRate: 0.02,
      ...options,
    };
  }

  /**
   * Calculate all factors for a symbol
   */
  calculateAll(
    symbol: string,
    prices: PriceData[],
    fundamentals?: FundamentalData
  ): FactorData {
    const allFactors = this.calculateAllCategories(prices, fundamentals);
    const factors = this.flattenFactors(allFactors);

    return {
      symbol,
      timestamp: Date.now(),
      factors,
    };
  }

  /**
   * Calculate factors organized by category
   */
  calculateAllCategories(
    prices: PriceData[],
    fundamentals?: FundamentalData
  ): AllFactors {
    const currentPrice = prices.length > 0 ? prices[prices.length - 1].close : 0;

    return {
      momentum: calculateMomentumFactors(prices),
      value: fundamentals
        ? calculateValueFactors(currentPrice, fundamentals)
        : this.emptyValueFactors(),
      quality: fundamentals
        ? calculateQualityFactors(fundamentals)
        : this.emptyQualityFactors(),
      size: fundamentals
        ? calculateSizeFactors(fundamentals)
        : this.emptySizeFactors(),
      volatility: calculateVolatilityFactors(
        prices,
        this.options.benchmark,
        this.options.riskFreeRate
      ),
      technical: calculateTechnicalFactors(prices),
    };
  }

  /**
   * Flatten categorized factors into a flat record
   */
  private flattenFactors(
    allFactors: AllFactors
  ): Record<string, FactorValue> {
    const result: Record<string, FactorValue> = {};

    for (const [category, factors] of Object.entries(allFactors)) {
      for (const [name, value] of Object.entries(factors)) {
        result[name] = {
          name,
          value: value as number | null,
        };
      }
    }

    return result;
  }

  /**
   * Normalize factors across multiple symbols
   */
  normalizeFactors(
    factorDataList: FactorData[],
    method: NormalizationMethod = 'percentile'
  ): FactorData[] {
    // Collect all factor values by name
    const factorValues: Record<string, number[]> = {};

    for (const data of factorDataList) {
      for (const [name, factor] of Object.entries(data.factors)) {
        if (factor.value !== null) {
          if (!factorValues[name]) factorValues[name] = [];
          factorValues[name].push(factor.value);
        }
      }
    }

    // Normalize each factor
    return factorDataList.map((data) => ({
      ...data,
      factors: Object.fromEntries(
        Object.entries(data.factors).map(([name, factor]) => {
          if (factor.value === null || !factorValues[name]?.length) {
            return [name, factor];
          }

          const normalized = this.normalizeValue(
            factor.value,
            factorValues[name],
            method
          );

          return [
            name,
            {
              ...factor,
              percentile: method === 'percentile' ? normalized : undefined,
              zscore: method === 'zscore' ? normalized : undefined,
            },
          ];
        })
      ),
    }));
  }

  /**
   * Normalize a single value
   */
  private normalizeValue(
    value: number,
    allValues: number[],
    method: NormalizationMethod
  ): number {
    switch (method) {
      case 'percentile':
        return percentileRank(value, allValues);
      case 'zscore':
        return zscore(value, allValues);
      case 'minmax':
        return minMaxNorm(value, allValues) * 100;
      case 'rank':
        const sorted = [...allValues].sort((a, b) => a - b);
        return (sorted.indexOf(value) + 1) / sorted.length * 100;
      default:
        return value;
    }
  }

  /**
   * Calculate composite score from weighted factors
   */
  calculateCompositeScore(
    factorData: FactorData,
    weights: CompositeWeights = {}
  ): number {
    const defaultWeights: CompositeWeights = {
      momentum: 0.2,
      value: 0.2,
      quality: 0.2,
      size: 0.1,
      volatility: 0.15,
      technical: 0.15,
    };

    const finalWeights = { ...defaultWeights, ...weights };
    let totalScore = 0;
    let totalWeight = 0;

    for (const [name, factor] of Object.entries(factorData.factors)) {
      if (factor.value === null || factor.percentile === undefined) continue;

      const definition = FACTOR_DEFINITIONS[name];
      if (!definition) continue;

      const categoryWeight = finalWeights[definition.category] ?? 0;
      if (categoryWeight === 0) continue;

      // Adjust score based on higherIsBetter
      let score = factor.percentile;
      if (!definition.higherIsBetter) {
        score = 100 - score;
      }

      totalScore += score * categoryWeight;
      totalWeight += categoryWeight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Get factors by category
   */
  getFactorsByCategory(
    factorData: FactorData,
    category: FactorCategory
  ): Record<string, FactorValue> {
    return Object.fromEntries(
      Object.entries(factorData.factors).filter(([name]) => {
        const def = FACTOR_DEFINITIONS[name];
        return def?.category === category;
      })
    );
  }

  /** Empty factor objects for missing data */
  private emptyValueFactors() {
    return {
      pe_ratio: null,
      pb_ratio: null,
      ps_ratio: null,
      dividend_yield: null,
      ev_ebitda: null,
      price_to_fcf: null,
    };
  }

  private emptyQualityFactors() {
    return {
      roe: null,
      roa: null,
      roic: null,
      debt_to_equity: null,
      current_ratio: null,
      profit_margin: null,
      gross_margin: null,
    };
  }

  private emptySizeFactors() {
    return {
      market_cap: null,
      market_cap_log: null,
      float_shares: null,
    };
  }
}

/** Default calculator instance */
export const factorCalculator = new FactorCalculator();
