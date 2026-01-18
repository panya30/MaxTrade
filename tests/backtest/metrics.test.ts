/**
 * Metrics Tests
 */

import { describe, test, expect } from 'bun:test';
import {
  calculateMetrics,
  calculateBenchmarkComparison,
  calculateMonthlyReturns,
} from '../../src/backtest/metrics';
import type { EquityPoint, Trade } from '../../src/backtest/types';

describe('calculateMetrics', () => {
  const createEquityCurve = (values: number[], startDate = Date.now()): EquityPoint[] => {
    return values.map((equity, i) => ({
      date: startDate + i * 86400000,
      equity,
      cash: equity * 0.1,
      invested: equity * 0.9,
      dailyReturn: i > 0 ? ((equity - values[i - 1]) / values[i - 1]) * 100 : 0,
      cumulativeReturn: ((equity - values[0]) / values[0]) * 100,
      drawdown: 0,
    }));
  };

  test('should calculate total return', () => {
    const curve = createEquityCurve([100000, 105000, 110000]);
    const metrics = calculateMetrics(curve, [], 100000);

    expect(metrics.totalReturn).toBe(10000);
    expect(metrics.totalReturnPercent).toBe(10);
  });

  test('should calculate final value', () => {
    const curve = createEquityCurve([100000, 120000, 115000]);
    const metrics = calculateMetrics(curve, [], 100000);

    expect(metrics.finalValue).toBe(115000);
  });

  test('should calculate max drawdown', () => {
    // Peak at 120, trough at 90 = 25% drawdown
    const curve = createEquityCurve([100000, 120000, 110000, 90000, 100000]);
    const metrics = calculateMetrics(curve, [], 100000);

    expect(metrics.maxDrawdown).toBeCloseTo(25, 0);
  });

  test('should calculate volatility', () => {
    // Volatile sequence
    const curve = createEquityCurve([100000, 110000, 95000, 115000, 100000]);
    const metrics = calculateMetrics(curve, [], 100000);

    expect(metrics.volatility).toBeGreaterThan(0);
  });

  test('should calculate trade statistics', () => {
    const trades: Trade[] = [
      {
        id: '1',
        timestamp: Date.now(),
        symbol: 'AAPL',
        side: 'buy',
        quantity: 100,
        price: 150,
        commission: 0,
        slippage: 0,
        status: 'filled',
      },
      {
        id: '2',
        timestamp: Date.now(),
        symbol: 'AAPL',
        side: 'sell',
        quantity: 100,
        price: 160,
        commission: 0,
        slippage: 0,
        status: 'filled',
        pnl: 1000,
        pnlPercent: 6.67,
        holdingPeriodDays: 5,
      },
      {
        id: '3',
        timestamp: Date.now(),
        symbol: 'GOOGL',
        side: 'buy',
        quantity: 50,
        price: 100,
        commission: 0,
        slippage: 0,
        status: 'filled',
      },
      {
        id: '4',
        timestamp: Date.now(),
        symbol: 'GOOGL',
        side: 'sell',
        quantity: 50,
        price: 90,
        commission: 0,
        slippage: 0,
        status: 'filled',
        pnl: -500,
        pnlPercent: -10,
        holdingPeriodDays: 3,
      },
    ];

    const curve = createEquityCurve([100000, 100500]);
    const metrics = calculateMetrics(curve, trades, 100000);

    expect(metrics.totalTrades).toBe(4);
    expect(metrics.winningTrades).toBe(1);
    expect(metrics.losingTrades).toBe(1);
    expect(metrics.winRate).toBe(50);
    expect(metrics.profitFactor).toBe(2); // 1000/500
    expect(metrics.avgWin).toBe(1000);
    expect(metrics.avgLoss).toBe(500);
    expect(metrics.largestWin).toBe(1000);
    expect(metrics.largestLoss).toBe(500);
  });

  test('should handle empty equity curve', () => {
    const metrics = calculateMetrics([], [], 100000);

    expect(metrics.totalReturn).toBe(0);
    expect(metrics.sharpeRatio).toBe(0);
    expect(metrics.maxDrawdown).toBe(0);
  });
});

describe('calculateBenchmarkComparison', () => {
  test('should calculate excess return', () => {
    const equityCurve: EquityPoint[] = [
      {
        date: 1,
        equity: 100000,
        cash: 10000,
        invested: 90000,
        dailyReturn: 0,
        cumulativeReturn: 0,
        drawdown: 0,
      },
      {
        date: 2,
        equity: 120000,
        cash: 12000,
        invested: 108000,
        dailyReturn: 20,
        cumulativeReturn: 20,
        drawdown: 0,
      },
    ];
    const benchmarkPrices = [100, 110];

    const comparison = calculateBenchmarkComparison(equityCurve, benchmarkPrices);

    expect(comparison.benchmarkReturn).toBeCloseTo(10, 5); // 10% benchmark return
    expect(comparison.excessReturn).toBeCloseTo(10, 5); // Strategy 20% - Benchmark 10%
  });

  test('should calculate correlation', () => {
    const equityCurve: EquityPoint[] = [
      {
        date: 1,
        equity: 100,
        cash: 10,
        invested: 90,
        dailyReturn: 0,
        cumulativeReturn: 0,
        drawdown: 0,
      },
      {
        date: 2,
        equity: 110,
        cash: 11,
        invested: 99,
        dailyReturn: 10,
        cumulativeReturn: 10,
        drawdown: 0,
      },
      {
        date: 3,
        equity: 120,
        cash: 12,
        invested: 108,
        dailyReturn: 9.1,
        cumulativeReturn: 20,
        drawdown: 0,
      },
    ];
    const benchmarkPrices = [100, 110, 120];

    const comparison = calculateBenchmarkComparison(equityCurve, benchmarkPrices);

    // Perfect correlation when moving together
    expect(comparison.correlation).toBeGreaterThan(0.9);
  });

  test('should handle empty data', () => {
    const comparison = calculateBenchmarkComparison([], []);

    expect(comparison.alpha).toBe(0);
    expect(comparison.beta).toBe(1);
    expect(comparison.correlation).toBe(0);
  });
});

describe('calculateMonthlyReturns', () => {
  test('should calculate monthly returns', () => {
    const startDate = new Date('2024-01-15').getTime();
    const midMonth = new Date('2024-01-25').getTime();
    const nextMonth = new Date('2024-02-15').getTime();

    const equityCurve: EquityPoint[] = [
      {
        date: startDate,
        equity: 100000,
        cash: 10000,
        invested: 90000,
        dailyReturn: 0,
        cumulativeReturn: 0,
        drawdown: 0,
      },
      {
        date: midMonth,
        equity: 105000,
        cash: 10500,
        invested: 94500,
        dailyReturn: 0.5,
        cumulativeReturn: 5,
        drawdown: 0,
      },
      {
        date: nextMonth,
        equity: 110000,
        cash: 11000,
        invested: 99000,
        dailyReturn: 0.5,
        cumulativeReturn: 10,
        drawdown: 0,
      },
    ];

    const monthlyReturns = calculateMonthlyReturns(equityCurve);

    expect(monthlyReturns.length).toBeGreaterThan(0);
    expect(monthlyReturns[0]).toHaveProperty('year');
    expect(monthlyReturns[0]).toHaveProperty('month');
    expect(monthlyReturns[0]).toHaveProperty('return');
  });

  test('should handle empty curve', () => {
    const monthlyReturns = calculateMonthlyReturns([]);
    expect(monthlyReturns).toHaveLength(0);
  });
});

describe('Metrics Edge Cases (Issue #27 regression)', () => {
  const createEquityCurve = (values: number[], startDate = Date.now()): EquityPoint[] => {
    return values.map((equity, i) => ({
      date: startDate + i * 86400000,
      equity,
      cash: equity * 0.1,
      invested: equity * 0.9,
      dailyReturn: i > 0 ? ((equity - values[i - 1]) / values[i - 1]) * 100 : 0,
      cumulativeReturn: ((equity - values[0]) / values[0]) * 100,
      drawdown: 0,
    }));
  };

  test('should not return NaN for any metric with valid data', () => {
    const curve = createEquityCurve([100000, 105000, 103000, 107000]);
    const metrics = calculateMetrics(curve, [], 100000);

    expect(isNaN(metrics.totalReturn)).toBe(false);
    expect(isNaN(metrics.totalReturnPercent)).toBe(false);
    expect(isNaN(metrics.sharpeRatio)).toBe(false);
    expect(isNaN(metrics.sortinoRatio)).toBe(false);
    expect(isNaN(metrics.volatility)).toBe(false);
    expect(isNaN(metrics.maxDrawdown)).toBe(false);
    expect(isNaN(metrics.finalValue)).toBe(false);
  });

  test('should return 0 sharpe ratio for flat equity curve (zero volatility)', () => {
    // All same values - zero volatility
    const curve = createEquityCurve([100000, 100000, 100000, 100000]);
    const metrics = calculateMetrics(curve, [], 100000);

    expect(metrics.sharpeRatio).toBe(0);
    expect(isNaN(metrics.sharpeRatio)).toBe(false);
    expect(isFinite(metrics.sharpeRatio)).toBe(true);
  });

  test('should not overflow sharpe ratio (should be clamped)', () => {
    const curve = createEquityCurve([100000, 100001, 100000, 100001]);
    const metrics = calculateMetrics(curve, [], 100000);

    // Sharpe should be clamped between -100 and 100
    expect(metrics.sharpeRatio).toBeGreaterThanOrEqual(-100);
    expect(metrics.sharpeRatio).toBeLessThanOrEqual(100);
    expect(isFinite(metrics.sharpeRatio)).toBe(true);
  });

  test('should handle empty equity curve', () => {
    const metrics = calculateMetrics([], [], 100000);

    expect(metrics.sharpeRatio).toBe(0);
    expect(metrics.totalReturn).toBe(0);
    expect(metrics.finalValue).toBe(0);
  });

  test('should handle zero initial capital', () => {
    const curve = createEquityCurve([0, 100, 200]);
    const metrics = calculateMetrics(curve, [], 0);

    expect(metrics.totalReturnPercent).toBe(0);
    expect(isNaN(metrics.totalReturnPercent)).toBe(false);
  });

  test('should handle single data point', () => {
    const curve = createEquityCurve([100000]);
    const metrics = calculateMetrics(curve, [], 100000);

    expect(metrics.sharpeRatio).toBe(0);
    expect(metrics.volatility).toBe(0);
    expect(isNaN(metrics.sharpeRatio)).toBe(false);
  });

  test('should not return Infinity for sortino ratio', () => {
    // All positive returns (no downside)
    const curve = createEquityCurve([100000, 101000, 102000, 103000]);
    const metrics = calculateMetrics(curve, [], 100000);

    expect(isFinite(metrics.sortinoRatio)).toBe(true);
    expect(metrics.sortinoRatio).toBeLessThanOrEqual(100);
  });

  test('should handle very small price changes without overflow', () => {
    // Tiny price changes that could cause near-zero volatility
    const curve = createEquityCurve([100000, 100000.01, 100000.02, 100000.01, 100000.03]);
    const metrics = calculateMetrics(curve, [], 100000);

    expect(isFinite(metrics.sharpeRatio)).toBe(true);
    expect(isFinite(metrics.sortinoRatio)).toBe(true);
    expect(Math.abs(metrics.sharpeRatio)).toBeLessThanOrEqual(100);
  });
});
