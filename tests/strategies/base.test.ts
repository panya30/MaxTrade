/**
 * Base Strategy Tests
 */

import { describe, test, expect } from 'bun:test';
import { BaseStrategy } from '../../src/strategies/base';
import type {
  StrategyInput,
  StrategyResult,
  ParamDefinition,
  RiskLevel,
} from '../../src/strategies/types';
import type { FactorData } from '../../src/factors/types';

// Concrete test implementation
class TestStrategy extends BaseStrategy {
  readonly name = 'test-strategy';
  readonly description = 'Test strategy for unit testing';
  readonly riskLevel: RiskLevel = 'medium';

  readonly paramDefinitions: ParamDefinition[] = [
    {
      name: 'threshold',
      type: 'number',
      default: 50,
      min: 0,
      max: 100,
      description: 'Test threshold',
    },
    {
      name: 'mode',
      type: 'select',
      default: 'normal',
      options: ['normal', 'aggressive', 'conservative'],
      description: 'Operating mode',
    },
    {
      name: 'enabled',
      type: 'boolean',
      default: true,
      description: 'Enable feature',
    },
  ];

  generateSignals(input: StrategyInput): StrategyResult {
    const startTime = Date.now();
    const signals = [];

    for (const symbol of input.symbols) {
      const factorData = input.factorData.get(symbol);
      if (!factorData) continue;

      const threshold = this._parameters.threshold as number;
      const momentum = this.getFactorPercentile(factorData, 'momentum_20d');

      if (momentum !== null && momentum > threshold) {
        signals.push(
          this.createSignal(symbol, 'buy', 0.8, momentum, [], {})
        );
      }
    }

    return this.createResult(signals, startTime);
  }
}

describe('BaseStrategy', () => {
  describe('parameter management', () => {
    test('should initialize with default parameters', () => {
      const strategy = new TestStrategy();

      expect(strategy.parameters.threshold).toBe(50);
      expect(strategy.parameters.mode).toBe('normal');
      expect(strategy.parameters.enabled).toBe(true);
    });

    test('should allow setting valid parameters', () => {
      const strategy = new TestStrategy();

      strategy.setParams({ threshold: 75, mode: 'aggressive' });

      expect(strategy.parameters.threshold).toBe(75);
      expect(strategy.parameters.mode).toBe('aggressive');
    });

    test('should reject invalid number parameters', () => {
      const strategy = new TestStrategy();

      expect(() => strategy.setParams({ threshold: 150 })).toThrow();
      expect(() => strategy.setParams({ threshold: -10 })).toThrow();
    });

    test('should reject invalid select parameters', () => {
      const strategy = new TestStrategy();

      expect(() => strategy.setParams({ mode: 'invalid' })).toThrow();
    });

    test('should validate all parameters', () => {
      const strategy = new TestStrategy();

      const valid = strategy.validateParams({
        threshold: 50,
        mode: 'normal',
        enabled: true,
      });
      expect(valid.valid).toBe(true);
      expect(valid.errors).toHaveLength(0);

      const invalid = strategy.validateParams({
        threshold: 200,
        mode: 'invalid',
        enabled: 'yes', // wrong type
      });
      expect(invalid.valid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThan(0);
    });
  });

  describe('signal generation', () => {
    test('should generate signals from input', () => {
      const strategy = new TestStrategy();
      strategy.setParams({ threshold: 60 });

      const factorData: FactorData = {
        symbol: 'AAPL',
        timestamp: Date.now(),
        factors: {
          momentum_20d: { name: 'momentum_20d', value: 15, percentile: 75 },
        },
      };

      const input: StrategyInput = {
        symbols: ['AAPL'],
        factorData: new Map([['AAPL', factorData]]),
        priceData: new Map(),
      };

      const result = strategy.generateSignals(input);

      expect(result.strategyName).toBe('test-strategy');
      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].symbol).toBe('AAPL');
      expect(result.signals[0].action).toBe('buy');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    test('should not generate signal below threshold', () => {
      const strategy = new TestStrategy();
      strategy.setParams({ threshold: 80 });

      const factorData: FactorData = {
        symbol: 'AAPL',
        timestamp: Date.now(),
        factors: {
          momentum_20d: { name: 'momentum_20d', value: 10, percentile: 50 },
        },
      };

      const input: StrategyInput = {
        symbols: ['AAPL'],
        factorData: new Map([['AAPL', factorData]]),
        priceData: new Map(),
      };

      const result = strategy.generateSignals(input);

      expect(result.signals).toHaveLength(0);
    });
  });

  describe('utility methods', () => {
    test('should calculate weighted score correctly', () => {
      const strategy = new TestStrategy();

      const factorData: FactorData = {
        symbol: 'TEST',
        timestamp: Date.now(),
        factors: {
          factor_a: { name: 'factor_a', value: 10, percentile: 80 },
          factor_b: { name: 'factor_b', value: 5, percentile: 30 },
        },
      };

      const result = (strategy as any).calculateWeightedScore(factorData, {
        factor_a: { weight: 0.6, higherIsBetter: true },
        factor_b: { weight: 0.4, higherIsBetter: false },
      });

      // factor_a: 80 * 0.6 = 48
      // factor_b: (100-30) * 0.4 = 28
      // Total: 76
      expect(result.score).toBeCloseTo(76, 1);
      expect(result.contributions).toHaveLength(2);
    });

    test('should determine action from score', () => {
      const strategy = new TestStrategy();

      expect((strategy as any).scoreToAction(80, 70, 30)).toBe('buy');
      expect((strategy as any).scoreToAction(20, 70, 30)).toBe('sell');
      expect((strategy as any).scoreToAction(50, 70, 30)).toBe('hold');
    });
  });
});
