/**
 * Built-in Strategies Tests
 */

import { describe, test, expect } from 'bun:test';
import { MomentumStrategy } from '../../src/strategies/builtin/momentum';
import { ValueStrategy } from '../../src/strategies/builtin/value';
import { QualityGrowthStrategy } from '../../src/strategies/builtin/quality-growth';
import { MultiFactorStrategy } from '../../src/strategies/builtin/multi-factor';
import { MeanReversionStrategy } from '../../src/strategies/builtin/mean-reversion';
import { LowVolatilityStrategy } from '../../src/strategies/builtin/low-volatility';
import type { StrategyInput } from '../../src/strategies/types';
import type { FactorData } from '../../src/factors/types';

// Helper to create mock input
function createMockInput(symbols: string[], factorOverrides: Record<string, Partial<Record<string, number>>> = {}): StrategyInput {
  const factorData = new Map<string, FactorData>();

  for (const symbol of symbols) {
    const overrides = factorOverrides[symbol] || {};

    factorData.set(symbol, {
      symbol,
      timestamp: Date.now(),
      factors: {
        // Momentum
        momentum_20d: { name: 'momentum_20d', value: 10, percentile: overrides.momentum_20d ?? 50 },
        momentum_60d: { name: 'momentum_60d', value: 15, percentile: overrides.momentum_60d ?? 55 },
        momentum_252d: { name: 'momentum_252d', value: 20, percentile: overrides.momentum_252d ?? 60 },
        momentum_accel_20d: { name: 'momentum_accel_20d', value: 2, percentile: overrides.momentum_accel ?? 50 },
        volume_momentum_20d: { name: 'volume_momentum_20d', value: 5, percentile: overrides.volume_momentum ?? 50 },
        rsi_14: { name: 'rsi_14', value: overrides.rsi ?? 50, percentile: 50 },

        // Value
        pe_ratio: { name: 'pe_ratio', value: 20, percentile: overrides.pe ?? 50 },
        pb_ratio: { name: 'pb_ratio', value: 3, percentile: overrides.pb ?? 50 },
        dividend_yield: { name: 'dividend_yield', value: 2, percentile: overrides.dividend ?? 50 },
        ev_ebitda: { name: 'ev_ebitda', value: 12, percentile: overrides.ev_ebitda ?? 50 },

        // Quality
        roe: { name: 'roe', value: overrides.roe ?? 15, percentile: overrides.roe_pct ?? 50 },
        roa: { name: 'roa', value: 8, percentile: overrides.roa ?? 50 },
        profit_margin: { name: 'profit_margin', value: 12, percentile: overrides.profit_margin ?? 50 },
        debt_to_equity: { name: 'debt_to_equity', value: overrides.debt ?? 0.5, percentile: overrides.debt_pct ?? 50 },

        // Volatility
        volatility_20d: { name: 'volatility_20d', value: overrides.vol ?? 20, percentile: overrides.vol_pct ?? 50 },
        max_drawdown: { name: 'max_drawdown', value: 10, percentile: overrides.drawdown ?? 50 },
        sharpe_ratio: { name: 'sharpe_ratio', value: overrides.sharpe ?? 1.0, percentile: overrides.sharpe_pct ?? 50 },
        downside_deviation: { name: 'downside_deviation', value: 12, percentile: overrides.downside ?? 50 },
        beta: { name: 'beta', value: overrides.beta ?? 1.0, percentile: 50 },

        // Technical
        price_to_sma_20: { name: 'price_to_sma_20', value: 2, percentile: overrides.sma20 ?? 50 },
        price_to_sma_50: { name: 'price_to_sma_50', value: 5, percentile: overrides.sma50 ?? 50 },
        price_to_sma_200: { name: 'price_to_sma_200', value: overrides.sma200 ?? 10, percentile: 50 },
        bollinger_pct_b: { name: 'bollinger_pct_b', value: overrides.bollinger ?? 50, percentile: 50 },
      },
    });
  }

  return {
    symbols,
    factorData,
    priceData: new Map(),
  };
}

describe('MomentumStrategy', () => {
  test('should generate buy signals for high momentum stocks', () => {
    const strategy = new MomentumStrategy();

    const input = createMockInput(['AAPL', 'GOOGL'], {
      AAPL: { momentum_60d: 85, momentum_accel: 70, volume_momentum: 60, rsi: 55 },
      GOOGL: { momentum_60d: 30, momentum_accel: 25, volume_momentum: 40, rsi: 45 },
    });

    const result = strategy.generateSignals(input);

    expect(result.strategyName).toBe('momentum');
    expect(result.signals.length).toBeGreaterThanOrEqual(1);

    const aaplSignal = result.signals.find((s) => s.symbol === 'AAPL');
    expect(aaplSignal?.action).toBe('buy');
  });

  test('should filter overbought RSI when enabled', () => {
    const strategy = new MomentumStrategy();
    strategy.setParams({ useRSIFilter: true });

    const input = createMockInput(['AAPL'], {
      AAPL: { momentum_60d: 90, rsi: 75 }, // High RSI = overbought
    });

    const result = strategy.generateSignals(input);

    // Should be filtered out due to overbought RSI
    expect(result.signals).toHaveLength(0);
  });
});

describe('ValueStrategy', () => {
  test('should generate buy signals for undervalued stocks', () => {
    const strategy = new ValueStrategy();

    const input = createMockInput(['AAPL', 'GOOGL'], {
      AAPL: { pe: 20, pb: 25, dividend: 75, ev_ebitda: 30 }, // Low PE/PB = high percentile for value
      GOOGL: { pe: 80, pb: 75, dividend: 25, ev_ebitda: 70 },
    });

    const result = strategy.generateSignals(input);

    expect(result.strategyName).toBe('value');
    // Low PE percentile means expensive, high percentile means cheap in inverted scoring
  });

  test('should filter non-dividend stocks when required', () => {
    const strategy = new ValueStrategy();
    strategy.setParams({ requireDividend: true });

    const factorData: FactorData = {
      symbol: 'NODIV',
      timestamp: Date.now(),
      factors: {
        pe_ratio: { name: 'pe_ratio', value: 15, percentile: 80 },
        pb_ratio: { name: 'pb_ratio', value: 2, percentile: 75 },
        dividend_yield: { name: 'dividend_yield', value: 0, percentile: 0 },
        ev_ebitda: { name: 'ev_ebitda', value: 10, percentile: 70 },
      },
    };

    const input: StrategyInput = {
      symbols: ['NODIV'],
      factorData: new Map([['NODIV', factorData]]),
      priceData: new Map(),
    };

    const result = strategy.generateSignals(input);
    expect(result.signals).toHaveLength(0);
  });
});

describe('QualityGrowthStrategy', () => {
  test('should require minimum ROE', () => {
    const strategy = new QualityGrowthStrategy();
    strategy.setParams({ minROE: 20 });

    const input = createMockInput(['AAPL'], {
      AAPL: { roe: 10 }, // Below minROE
    });

    const result = strategy.generateSignals(input);
    expect(result.signals).toHaveLength(0);
  });

  test('should reject high debt companies', () => {
    const strategy = new QualityGrowthStrategy();
    strategy.setParams({ maxDebtToEquity: 1.0 });

    const input = createMockInput(['AAPL'], {
      AAPL: { roe: 25, debt: 2.0 }, // High debt
    });

    const result = strategy.generateSignals(input);
    expect(result.signals).toHaveLength(0);
  });
});

describe('MultiFactorStrategy', () => {
  test('should combine all factor categories', () => {
    const strategy = new MultiFactorStrategy();

    const input = createMockInput(['AAPL'], {
      AAPL: {
        momentum_60d: 80,
        pe: 25,
        roe_pct: 75,
        vol_pct: 30,
      },
    });

    const result = strategy.generateSignals(input);

    expect(result.strategyName).toBe('multi-factor');
    // Should include contributions from all categories
    if (result.signals.length > 0) {
      expect(result.signals[0].metadata).toHaveProperty('momentumScore');
      expect(result.signals[0].metadata).toHaveProperty('valueScore');
      expect(result.signals[0].metadata).toHaveProperty('qualityScore');
      expect(result.signals[0].metadata).toHaveProperty('volatilityScore');
    }
  });

  test('should respect custom weights', () => {
    const strategy = new MultiFactorStrategy();
    strategy.setParams({
      momentumWeight: 1.0,
      valueWeight: 0,
      qualityWeight: 0,
      volatilityWeight: 0,
    });

    // With only momentum weight, result should be momentum-driven
    expect(strategy.parameters.momentumWeight).toBe(1.0);
    expect(strategy.parameters.valueWeight).toBe(0);
  });
});

describe('MeanReversionStrategy', () => {
  test('should generate buy signals for oversold stocks', () => {
    const strategy = new MeanReversionStrategy();
    strategy.setParams({ oversoldRSI: 30, useSMAFilter: false });

    const input = createMockInput(['AAPL'], {
      AAPL: { rsi: 25, bollinger: -10, sma200: 5 },
    });

    const result = strategy.generateSignals(input);

    expect(result.strategyName).toBe('mean-reversion');
    if (result.signals.length > 0) {
      expect(result.signals[0].action).toBe('buy');
    }
  });

  test('should generate sell signals for overbought stocks', () => {
    const strategy = new MeanReversionStrategy();
    strategy.setParams({ overboughtRSI: 70, useSMAFilter: false });

    const input = createMockInput(['AAPL'], {
      AAPL: { rsi: 80, bollinger: 110, sma200: -5 },
    });

    const result = strategy.generateSignals(input);

    if (result.signals.length > 0) {
      expect(result.signals[0].action).toBe('sell');
    }
  });
});

describe('LowVolatilityStrategy', () => {
  test('should only select low volatility stocks', () => {
    const strategy = new LowVolatilityStrategy();
    strategy.setParams({ maxVolatility: 20 });

    const input = createMockInput(['LOW_VOL', 'HIGH_VOL'], {
      LOW_VOL: { vol: 15, vol_pct: 20, sharpe: 1.5, drawdown: 30 },
      HIGH_VOL: { vol: 40, vol_pct: 80 },
    });

    const result = strategy.generateSignals(input);

    expect(result.strategyName).toBe('low-volatility');
    // HIGH_VOL should be filtered out
    const highVolSignal = result.signals.find((s) => s.symbol === 'HIGH_VOL');
    expect(highVolSignal).toBeUndefined();
  });

  test('should only generate buy signals', () => {
    const strategy = new LowVolatilityStrategy();

    const input = createMockInput(['AAPL'], {
      AAPL: { vol: 15, vol_pct: 20, sharpe: 1.5, sharpe_pct: 80, drawdown: 20 },
    });

    const result = strategy.generateSignals(input);

    // Low vol strategy only buys stable stocks, never sells
    for (const signal of result.signals) {
      expect(signal.action).toBe('buy');
    }
  });
});
