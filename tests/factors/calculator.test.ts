/**
 * Factor Calculator Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  FactorCalculator,
  FACTOR_DEFINITIONS,
} from '../../src/factors/calculator';
import type { PriceData, FundamentalData, FactorData } from '../../src/factors/types';

describe('FactorCalculator', () => {
  let calculator: FactorCalculator;

  beforeEach(() => {
    calculator = new FactorCalculator({ riskFreeRate: 0.02 });
  });

  const generatePriceData = (count: number, trend: 'up' | 'down' | 'flat' = 'up'): PriceData[] => {
    return Array(count)
      .fill(0)
      .map((_, i) => {
        const base = 100;
        const change = trend === 'up' ? i * 0.5 : trend === 'down' ? -i * 0.5 : 0;
        const noise = Math.sin(i) * 2;
        const price = base + change + noise;

        return {
          timestamp: Date.now() - (count - i) * 86400000,
          open: price - 1,
          high: price + 2,
          low: price - 2,
          close: price,
          volume: 1000000 + Math.random() * 500000,
        };
      });
  };

  const sampleFundamentals: FundamentalData = {
    marketCap: 100_000_000_000,
    sharesOutstanding: 1_000_000_000,
    floatShares: 900_000_000,
    eps: 5.0,
    bookValuePerShare: 25.0,
    salesPerShare: 50.0,
    dividendPerShare: 1.0,
    ebitda: 20_000_000_000,
    enterpriseValue: 120_000_000_000,
    freeCashFlow: 15_000_000_000,
    netIncome: 10_000_000_000,
    totalAssets: 200_000_000_000,
    totalEquity: 80_000_000_000,
    totalDebt: 40_000_000_000,
    currentAssets: 50_000_000_000,
    currentLiabilities: 30_000_000_000,
    revenue: 100_000_000_000,
    grossProfit: 40_000_000_000,
    investedCapital: 100_000_000_000,
  };

  describe('calculateAll', () => {
    test('should return FactorData with all factors', () => {
      const prices = generatePriceData(300);
      const result = calculator.calculateAll('AAPL', prices, sampleFundamentals);

      expect(result.symbol).toBe('AAPL');
      expect(result.timestamp).toBeDefined();
      expect(Object.keys(result.factors).length).toBeGreaterThan(30);
    });

    test('should calculate momentum factors from prices', () => {
      const prices = generatePriceData(300, 'up');
      const result = calculator.calculateAll('AAPL', prices);

      expect(result.factors.momentum_20d?.value).not.toBeNull();
      expect(result.factors.rsi_14?.value).not.toBeNull();
      expect(result.factors.macd?.value).not.toBeNull();
    });

    test('should calculate value factors from fundamentals', () => {
      const prices = generatePriceData(50);
      const result = calculator.calculateAll('AAPL', prices, sampleFundamentals);

      expect(result.factors.pe_ratio?.value).not.toBeNull();
      expect(result.factors.pb_ratio?.value).not.toBeNull();
      expect(result.factors.dividend_yield?.value).not.toBeNull();
    });

    test('should handle missing fundamentals gracefully', () => {
      const prices = generatePriceData(50);
      const result = calculator.calculateAll('AAPL', prices);

      // Value/quality/size factors should be null without fundamentals
      expect(result.factors.pe_ratio?.value).toBeNull();
      expect(result.factors.roe?.value).toBeNull();
      expect(result.factors.market_cap?.value).toBeNull();

      // Technical/momentum/volatility should still work
      expect(result.factors.sma_20?.value).not.toBeNull();
      expect(result.factors.volatility_20d?.value).not.toBeNull();
    });
  });

  describe('calculateAllCategories', () => {
    test('should organize factors by category', () => {
      const prices = generatePriceData(300);
      const result = calculator.calculateAllCategories(prices, sampleFundamentals);

      expect(result.momentum).toBeDefined();
      expect(result.value).toBeDefined();
      expect(result.quality).toBeDefined();
      expect(result.size).toBeDefined();
      expect(result.volatility).toBeDefined();
      expect(result.technical).toBeDefined();
    });
  });

  describe('normalizeFactors', () => {
    test('should add percentile scores', () => {
      const factorDataList: FactorData[] = [
        {
          symbol: 'AAPL',
          timestamp: Date.now(),
          factors: {
            momentum_20d: { name: 'momentum_20d', value: 10 },
            pe_ratio: { name: 'pe_ratio', value: 20 },
          },
        },
        {
          symbol: 'GOOGL',
          timestamp: Date.now(),
          factors: {
            momentum_20d: { name: 'momentum_20d', value: 5 },
            pe_ratio: { name: 'pe_ratio', value: 25 },
          },
        },
        {
          symbol: 'MSFT',
          timestamp: Date.now(),
          factors: {
            momentum_20d: { name: 'momentum_20d', value: 15 },
            pe_ratio: { name: 'pe_ratio', value: 15 },
          },
        },
      ];

      const normalized = calculator.normalizeFactors(factorDataList, 'percentile');

      // MSFT has highest momentum (15), should have highest percentile
      const msft = normalized.find((d) => d.symbol === 'MSFT')!;
      expect(msft.factors.momentum_20d.percentile).toBeDefined();

      // GOOGL has lowest momentum (5), should have lowest percentile
      const googl = normalized.find((d) => d.symbol === 'GOOGL')!;
      expect(googl.factors.momentum_20d.percentile).toBeLessThan(
        msft.factors.momentum_20d.percentile!
      );
    });

    test('should handle null values', () => {
      const factorDataList: FactorData[] = [
        {
          symbol: 'AAPL',
          timestamp: Date.now(),
          factors: {
            momentum_20d: { name: 'momentum_20d', value: null },
          },
        },
      ];

      const normalized = calculator.normalizeFactors(factorDataList);
      expect(normalized[0].factors.momentum_20d.percentile).toBeUndefined();
    });
  });

  describe('calculateCompositeScore', () => {
    test('should calculate weighted composite score', () => {
      const factorData: FactorData = {
        symbol: 'AAPL',
        timestamp: Date.now(),
        factors: {
          momentum_20d: { name: 'momentum_20d', value: 10, percentile: 75 },
          pe_ratio: { name: 'pe_ratio', value: 15, percentile: 25 }, // Lower is better
          roe: { name: 'roe', value: 20, percentile: 80 },
          volatility_20d: { name: 'volatility_20d', value: 15, percentile: 30 }, // Lower is better
        },
      };

      const score = calculator.calculateCompositeScore(factorData);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('should respect custom weights', () => {
      const factorData: FactorData = {
        symbol: 'AAPL',
        timestamp: Date.now(),
        factors: {
          momentum_20d: { name: 'momentum_20d', value: 10, percentile: 90 },
          pe_ratio: { name: 'pe_ratio', value: 15, percentile: 10 }, // Low percentile = expensive
        },
      };

      // High momentum weight should favor this stock (momentum percentile is 90)
      const momentumScore = calculator.calculateCompositeScore(factorData, {
        momentum: 1.0,
        value: 0,
      });

      // High value weight should penalize this stock
      // pe_ratio is low percentile (10), but pe_ratio higherIsBetter=false
      // so score = 100 - 10 = 90 (same as momentum!)
      // Need different percentiles to see the difference
      const factorData2: FactorData = {
        symbol: 'AAPL',
        timestamp: Date.now(),
        factors: {
          momentum_20d: { name: 'momentum_20d', value: 10, percentile: 90 },
          pe_ratio: { name: 'pe_ratio', value: 50, percentile: 80 }, // High percentile = expensive
        },
      };

      const valueScore = calculator.calculateCompositeScore(factorData2, {
        momentum: 0,
        value: 1.0,
      });

      // valueScore should be lower because pe_ratio has high percentile (80)
      // and since higherIsBetter=false, the adjusted score is 100-80=20
      expect(momentumScore).toBeGreaterThan(valueScore);
    });
  });

  describe('getFactorsByCategory', () => {
    test('should filter factors by category', () => {
      const prices = generatePriceData(100);
      const factorData = calculator.calculateAll('AAPL', prices);

      const momentumFactors = calculator.getFactorsByCategory(factorData, 'momentum');
      const technicalFactors = calculator.getFactorsByCategory(factorData, 'technical');

      // Check that we got the right categories
      for (const [name] of Object.entries(momentumFactors)) {
        expect(FACTOR_DEFINITIONS[name]?.category).toBe('momentum');
      }

      for (const [name] of Object.entries(technicalFactors)) {
        expect(FACTOR_DEFINITIONS[name]?.category).toBe('technical');
      }
    });
  });
});

describe('FACTOR_DEFINITIONS', () => {
  test('should have definitions for key factors', () => {
    expect(FACTOR_DEFINITIONS.momentum_20d).toBeDefined();
    expect(FACTOR_DEFINITIONS.pe_ratio).toBeDefined();
    expect(FACTOR_DEFINITIONS.roe).toBeDefined();
    expect(FACTOR_DEFINITIONS.volatility_20d).toBeDefined();
    expect(FACTOR_DEFINITIONS.sma_20).toBeUndefined(); // Not all factors need definitions
  });

  test('should have correct higherIsBetter flags', () => {
    expect(FACTOR_DEFINITIONS.momentum_20d.higherIsBetter).toBe(true);
    expect(FACTOR_DEFINITIONS.pe_ratio.higherIsBetter).toBe(false);
    expect(FACTOR_DEFINITIONS.sharpe_ratio.higherIsBetter).toBe(true);
    expect(FACTOR_DEFINITIONS.volatility_20d.higherIsBetter).toBe(false);
  });
});
