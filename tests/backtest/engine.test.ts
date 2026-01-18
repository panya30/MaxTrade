/**
 * Backtest Engine Tests
 */

import { describe, test, expect } from 'bun:test';
import { BacktestEngine, createBacktestEngine, DEFAULT_CONFIG } from '../../src/backtest/engine';
import type { BacktestData, PriceBar } from '../../src/backtest/types';
import type { Signal } from '../../src/strategies/types';

describe('BacktestEngine', () => {
  // Create sample price data
  const createPriceData = (
    symbol: string,
    startPrice: number,
    days: number,
    trend: 'up' | 'down' | 'flat' = 'up'
  ): PriceBar[] => {
    const bars: PriceBar[] = [];
    let price = startPrice;

    for (let i = 0; i < days; i++) {
      const change = trend === 'up' ? 1 : trend === 'down' ? -1 : 0;
      price += change + (Math.random() - 0.5) * 2;
      price = Math.max(price, 1);

      bars.push({
        timestamp: Date.now() - (days - i) * 86400000,
        open: price - 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }

    return bars;
  };

  const createBacktestData = (symbols: string[], days = 100): BacktestData => {
    const prices = new Map<string, PriceBar[]>();

    for (const symbol of symbols) {
      prices.set(symbol, createPriceData(symbol, 100, days, 'up'));
    }

    const allBars = Array.from(prices.values()).flat();
    const timestamps = allBars.map((b) => b.timestamp);

    return {
      symbols,
      prices,
      startDate: Math.min(...timestamps),
      endDate: Math.max(...timestamps),
    };
  };

  describe('initialization', () => {
    test('should create with default config', () => {
      const engine = new BacktestEngine();
      const config = engine.getConfig();

      expect(config.initialCapital).toBe(DEFAULT_CONFIG.initialCapital);
      expect(config.maxPositions).toBe(DEFAULT_CONFIG.maxPositions);
    });

    test('should create with custom config', () => {
      const engine = new BacktestEngine({
        initialCapital: 50000,
        maxPositions: 10,
      });

      const config = engine.getConfig();
      expect(config.initialCapital).toBe(50000);
      expect(config.maxPositions).toBe(10);
    });

    test('should create via factory function', () => {
      const engine = createBacktestEngine({ initialCapital: 75000 });
      expect(engine.getConfig().initialCapital).toBe(75000);
    });
  });

  describe('run', () => {
    test('should run backtest with signals', () => {
      const engine = new BacktestEngine({
        initialCapital: 100000,
        positionSizing: 'equal_weight',
        maxPositions: 5,
      });

      const data = createBacktestData(['AAPL', 'GOOGL'], 50);

      // Simple signal generator: buy on first day
      let firstDay = true;
      const signalGenerator = (date: number): Signal[] => {
        if (firstDay) {
          firstDay = false;
          return [
            { symbol: 'AAPL', action: 'buy', confidence: 0.8, strength: 80, factors: [], timestamp: date },
            { symbol: 'GOOGL', action: 'buy', confidence: 0.7, strength: 70, factors: [], timestamp: date },
          ];
        }
        return [];
      };

      const result = engine.run(data, signalGenerator);

      expect(result.equityCurve.length).toBeGreaterThan(0);
      expect(result.trades.length).toBeGreaterThan(0);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.tradingDays).toBeGreaterThan(0);
    });

    test('should track equity curve', () => {
      const engine = new BacktestEngine({ initialCapital: 100000 });
      const data = createBacktestData(['AAPL'], 30);

      const result = engine.run(data, () => []);

      expect(result.equityCurve.length).toBe(30);
      expect(result.equityCurve[0].equity).toBe(100000);

      // Check all equity points have required fields
      for (const point of result.equityCurve) {
        expect(point).toHaveProperty('date');
        expect(point).toHaveProperty('equity');
        expect(point).toHaveProperty('cash');
        expect(point).toHaveProperty('dailyReturn');
      }
    });

    test('should close all positions at end', () => {
      const engine = new BacktestEngine();
      const data = createBacktestData(['AAPL'], 20);

      let bought = false;
      const signalGenerator = (): Signal[] => {
        if (!bought) {
          bought = true;
          return [{ symbol: 'AAPL', action: 'buy', confidence: 0.9, strength: 90, factors: [], timestamp: Date.now() }];
        }
        return [];
      };

      const result = engine.run(data, signalGenerator);

      // Should have closing sells
      const sells = result.trades.filter((t) => t.side === 'sell');
      expect(sells.length).toBeGreaterThan(0);

      // No final positions
      expect(result.finalPositions).toHaveLength(0);
    });

    test('should respect max positions', () => {
      const engine = new BacktestEngine({
        maxPositions: 2,
      });

      const data = createBacktestData(['AAPL', 'GOOGL', 'MSFT', 'AMZN'], 30);

      // Try to buy all 4 stocks
      let firstDay = true;
      const signalGenerator = (date: number): Signal[] => {
        if (firstDay) {
          firstDay = false;
          return [
            { symbol: 'AAPL', action: 'buy', confidence: 0.9, strength: 90, factors: [], timestamp: date },
            { symbol: 'GOOGL', action: 'buy', confidence: 0.8, strength: 80, factors: [], timestamp: date },
            { symbol: 'MSFT', action: 'buy', confidence: 0.7, strength: 70, factors: [], timestamp: date },
            { symbol: 'AMZN', action: 'buy', confidence: 0.6, strength: 60, factors: [], timestamp: date },
          ];
        }
        return [];
      };

      const result = engine.run(data, signalGenerator);

      // Should only have 2 buy trades (max positions)
      const buys = result.trades.filter((t) => t.side === 'buy');
      expect(buys.length).toBe(2);

      // Should be the highest confidence ones
      expect(buys.some((t) => t.symbol === 'AAPL')).toBe(true);
      expect(buys.some((t) => t.symbol === 'GOOGL')).toBe(true);
    });

    test('should calculate metrics', () => {
      const engine = new BacktestEngine({ initialCapital: 100000 });
      const data = createBacktestData(['AAPL'], 50);

      let bought = false;
      const signalGenerator = (date: number): Signal[] => {
        if (!bought) {
          bought = true;
          return [{ symbol: 'AAPL', action: 'buy', confidence: 0.8, strength: 80, factors: [], timestamp: date }];
        }
        return [];
      };

      const result = engine.run(data, signalGenerator);

      expect(result.metrics.totalTrades).toBeGreaterThan(0);
      expect(result.metrics.tradingDays).toBe(50);
      expect(result.metrics.startDate).toBeDefined();
      expect(result.metrics.endDate).toBeDefined();
    });

    test('should handle empty signals', () => {
      const engine = new BacktestEngine();
      const data = createBacktestData(['AAPL'], 20);

      const result = engine.run(data, () => []);

      expect(result.trades).toHaveLength(0);
      expect(result.equityCurve[result.equityCurve.length - 1].equity).toBe(100000);
    });
  });

  describe('position sizing', () => {
    test('should use equal weight sizing', () => {
      const engine = new BacktestEngine({
        initialCapital: 100000,
        positionSizing: 'equal_weight',
        maxPositions: 4,
      });

      const data = createBacktestData(['AAPL', 'GOOGL'], 20);

      let firstDay = true;
      const signalGenerator = (date: number): Signal[] => {
        if (firstDay) {
          firstDay = false;
          return [
            { symbol: 'AAPL', action: 'buy', confidence: 0.8, strength: 80, factors: [], timestamp: date },
            { symbol: 'GOOGL', action: 'buy', confidence: 0.8, strength: 80, factors: [], timestamp: date },
          ];
        }
        return [];
      };

      const result = engine.run(data, signalGenerator);
      const buys = result.trades.filter((t) => t.side === 'buy');

      // With equal weight, both positions should be similar size
      if (buys.length === 2) {
        const size1 = buys[0].quantity * buys[0].price;
        const size2 = buys[1].quantity * buys[1].price;
        const ratio = size1 / size2;
        expect(ratio).toBeGreaterThan(0.5);
        expect(ratio).toBeLessThan(2);
      }
    });
  });

  describe('rebalancing', () => {
    test('should rebalance daily by default', () => {
      const engine = new BacktestEngine({
        rebalanceFrequency: 'daily',
      });

      const data = createBacktestData(['AAPL'], 10);

      let callCount = 0;
      const signalGenerator = (): Signal[] => {
        callCount++;
        return [];
      };

      engine.run(data, signalGenerator);

      // Should be called every day
      expect(callCount).toBe(10);
    });

    test('should respect never rebalance', () => {
      const engine = new BacktestEngine({
        rebalanceFrequency: 'never',
      });

      const data = createBacktestData(['AAPL'], 30);

      let callCount = 0;
      const signalGenerator = (): Signal[] => {
        callCount++;
        return [];
      };

      engine.run(data, signalGenerator);

      // Should only be called on first day
      expect(callCount).toBe(1);
    });
  });

  describe('setConfig', () => {
    test('should update configuration', () => {
      const engine = new BacktestEngine({ initialCapital: 100000 });

      engine.setConfig({ initialCapital: 50000, maxPositions: 5 });

      const config = engine.getConfig();
      expect(config.initialCapital).toBe(50000);
      expect(config.maxPositions).toBe(5);
    });
  });
});
