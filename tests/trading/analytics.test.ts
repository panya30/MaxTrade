/**
 * Analytics Tests
 */

import { describe, test, expect } from 'bun:test';
import { Portfolio } from '../../src/trading/portfolio';
import {
  calculateAnalytics,
  calculateEquityCurve,
  calculateAllocation,
  calculatePerformanceBySymbol,
} from '../../src/trading/analytics';
import type { Trade } from '../../src/trading/types';

describe('Analytics', () => {
  describe('calculateAnalytics', () => {
    test('should return zeros for empty trades', () => {
      const analytics = calculateAnalytics([]);

      expect(analytics.totalTrades).toBe(0);
      expect(analytics.winRate).toBe(0);
      expect(analytics.profitFactor).toBe(0);
    });

    test('should calculate win rate', () => {
      const trades: Trade[] = [
        createTrade('AAPL', 'buy', 10, 100, 1),
        createTrade('AAPL', 'sell', 10, 110, 1, 100), // Win
        createTrade('GOOGL', 'buy', 5, 200, 2),
        createTrade('GOOGL', 'sell', 5, 190, 2, -50), // Loss
        createTrade('MSFT', 'buy', 8, 150, 3),
        createTrade('MSFT', 'sell', 8, 160, 3, 80), // Win
      ];

      const analytics = calculateAnalytics(trades);

      expect(analytics.winningTrades).toBe(2);
      expect(analytics.losingTrades).toBe(1);
      expect(analytics.winRate).toBeCloseTo(66.67, 0);
    });

    test('should calculate average win and loss', () => {
      const trades: Trade[] = [
        createTrade('AAPL', 'sell', 10, 110, 1, 100),
        createTrade('AAPL', 'sell', 10, 110, 2, 200),
        createTrade('GOOGL', 'sell', 5, 190, 3, -50),
      ];

      const analytics = calculateAnalytics(trades);

      expect(analytics.avgWin).toBe(150); // (100 + 200) / 2
      expect(analytics.avgLoss).toBe(50);
    });

    test('should calculate profit factor', () => {
      const trades: Trade[] = [
        createTrade('AAPL', 'sell', 10, 110, 1, 100),
        createTrade('GOOGL', 'sell', 5, 190, 2, -50),
      ];

      const analytics = calculateAnalytics(trades);

      expect(analytics.profitFactor).toBe(2); // 100 / 50
    });

    test('should handle all wins (infinite profit factor)', () => {
      const trades: Trade[] = [
        createTrade('AAPL', 'sell', 10, 110, 1, 100),
        createTrade('GOOGL', 'sell', 5, 210, 2, 50),
      ];

      const analytics = calculateAnalytics(trades);

      expect(analytics.profitFactor).toBe(Infinity);
    });

    test('should calculate total trades', () => {
      const trades: Trade[] = [
        createTrade('AAPL', 'buy', 10, 100, 1),
        createTrade('AAPL', 'sell', 10, 110, 2, 100),
        createTrade('GOOGL', 'buy', 5, 200, 3),
      ];

      const analytics = calculateAnalytics(trades);

      expect(analytics.totalTrades).toBe(3);
    });
  });

  describe('calculateEquityCurve', () => {
    test('should start with initial value', () => {
      const trades: Trade[] = [
        createTrade('AAPL', 'buy', 10, 100, Date.now()),
      ];

      const curve = calculateEquityCurve(100000, trades);

      expect(curve[0].equity).toBe(100000);
    });

    test('should update equity after trades with P&L', () => {
      const now = Date.now();
      const trades: Trade[] = [
        createTrade('AAPL', 'buy', 10, 100, now),
        createTrade('AAPL', 'sell', 10, 110, now + 1000, 100),
      ];

      const curve = calculateEquityCurve(100000, trades);

      // Last point should reflect P&L
      expect(curve[curve.length - 1].equity).toBe(100100);
    });

    test('should track multiple trades', () => {
      const now = Date.now();
      const trades: Trade[] = [
        createTrade('AAPL', 'sell', 10, 110, now, 100),
        createTrade('GOOGL', 'sell', 5, 210, now + 1000, 50),
        createTrade('MSFT', 'sell', 8, 145, now + 2000, -40),
      ];

      const curve = calculateEquityCurve(100000, trades);

      expect(curve.length).toBe(4); // Initial + 3 trades
      expect(curve[curve.length - 1].equity).toBe(100110); // 100 + 50 - 40
    });
  });

  describe('calculateAllocation', () => {
    test('should include cash allocation', () => {
      const portfolio = new Portfolio('Test', { initialCash: 100000 });

      const allocation = calculateAllocation(portfolio);

      expect(allocation.find((a) => a.symbol === 'CASH')).toBeDefined();
      expect(allocation.find((a) => a.symbol === 'CASH')?.pct).toBe(100);
    });

    test('should include position allocations', () => {
      const portfolio = new Portfolio('Test', { initialCash: 100000 });
      portfolio.buy('AAPL', 100, 100, 'ord1'); // 10k

      const allocation = calculateAllocation(portfolio);

      expect(allocation.some((a) => a.symbol === 'AAPL')).toBe(true);
      expect(allocation.find((a) => a.symbol === 'AAPL')?.pct).toBeCloseTo(10, 0);
    });

    test('should sort by value descending', () => {
      const portfolio = new Portfolio('Test', { initialCash: 100000 });
      portfolio.buy('AAPL', 50, 100, 'ord1'); // 5k
      portfolio.buy('GOOGL', 100, 100, 'ord2'); // 10k

      const allocation = calculateAllocation(portfolio);

      // Cash should be first (largest), then GOOGL, then AAPL
      expect(allocation[0].symbol).toBe('CASH');
      expect(allocation[1].symbol).toBe('GOOGL');
      expect(allocation[2].symbol).toBe('AAPL');
    });
  });

  describe('calculatePerformanceBySymbol', () => {
    test('should group trades by symbol', () => {
      const trades: Trade[] = [
        createTrade('AAPL', 'buy', 10, 100, 1),
        createTrade('AAPL', 'sell', 10, 110, 2, 100),
        createTrade('GOOGL', 'buy', 5, 200, 3),
        createTrade('GOOGL', 'sell', 5, 190, 4, -50),
      ];

      const performance = calculatePerformanceBySymbol(trades);

      expect(performance.get('AAPL')).toBeDefined();
      expect(performance.get('GOOGL')).toBeDefined();
    });

    test('should calculate P&L by symbol', () => {
      const trades: Trade[] = [
        createTrade('AAPL', 'sell', 10, 110, 1, 100),
        createTrade('AAPL', 'sell', 10, 120, 2, 200),
        createTrade('GOOGL', 'sell', 5, 190, 3, -50),
      ];

      const performance = calculatePerformanceBySymbol(trades);

      expect(performance.get('AAPL')?.pnl).toBe(300);
      expect(performance.get('GOOGL')?.pnl).toBe(-50);
    });

    test('should calculate win rate by symbol', () => {
      const trades: Trade[] = [
        createTrade('AAPL', 'sell', 10, 110, 1, 100),
        createTrade('AAPL', 'sell', 10, 95, 2, -50),
        createTrade('AAPL', 'sell', 10, 120, 3, 200),
      ];

      const performance = calculatePerformanceBySymbol(trades);

      expect(performance.get('AAPL')?.winRate).toBeCloseTo(66.67, 0);
    });

    test('should count total trades by symbol', () => {
      const trades: Trade[] = [
        createTrade('AAPL', 'buy', 10, 100, 1),
        createTrade('AAPL', 'sell', 5, 110, 2, 50),
        createTrade('AAPL', 'sell', 5, 105, 3, 25),
      ];

      const performance = calculatePerformanceBySymbol(trades);

      expect(performance.get('AAPL')?.trades).toBe(3);
    });
  });
});

// Helper function to create trade objects
function createTrade(
  symbol: string,
  side: 'buy' | 'sell',
  quantity: number,
  price: number,
  timestamp: number,
  pnl?: number
): Trade {
  return {
    id: `tr_${timestamp}`,
    orderId: `ord_${timestamp}`,
    portfolioId: 'test',
    symbol,
    side,
    quantity,
    price,
    commission: price * quantity * 0.001,
    timestamp,
    pnl,
  };
}
