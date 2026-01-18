/**
 * Portfolio Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Portfolio, DEFAULT_COMMISSION, DEFAULT_SLIPPAGE } from '../../src/backtest/portfolio';

describe('Portfolio', () => {
  let portfolio: Portfolio;
  const initialCapital = 100000;

  beforeEach(() => {
    portfolio = new Portfolio(initialCapital);
  });

  describe('initialization', () => {
    test('should initialize with correct cash', () => {
      expect(portfolio.getCash()).toBe(initialCapital);
    });

    test('should start with no positions', () => {
      expect(portfolio.getPositions()).toHaveLength(0);
    });

    test('should start with no trades', () => {
      expect(portfolio.getTrades()).toHaveLength(0);
    });
  });

  describe('buy', () => {
    test('should execute buy order', () => {
      const trade = portfolio.buy('AAPL', 100, 150, Date.now());

      expect(trade).not.toBeNull();
      expect(trade!.side).toBe('buy');
      expect(trade!.symbol).toBe('AAPL');
      expect(trade!.quantity).toBe(100);
      expect(trade!.status).toBe('filled');
    });

    test('should deduct cash for purchase', () => {
      portfolio.buy('AAPL', 100, 150, Date.now());

      // Cash should be reduced by cost + commission + slippage
      expect(portfolio.getCash()).toBeLessThan(initialCapital);
      expect(portfolio.getCash()).toBeLessThan(initialCapital - 15000); // At least cost
    });

    test('should create position', () => {
      portfolio.buy('AAPL', 100, 150, Date.now());

      const position = portfolio.getPosition('AAPL');
      expect(position).toBeDefined();
      expect(position!.quantity).toBe(100);
      expect(position!.symbol).toBe('AAPL');
    });

    test('should average cost on second buy', () => {
      portfolio.buy('AAPL', 100, 100, Date.now());
      portfolio.buy('AAPL', 100, 200, Date.now());

      const position = portfolio.getPosition('AAPL');
      expect(position!.quantity).toBe(200);
      // Average cost should be between 100 and 200 (with slippage)
      expect(position!.avgCost).toBeGreaterThan(100);
      expect(position!.avgCost).toBeLessThan(210);
    });

    test('should reject buy with insufficient funds', () => {
      const trade = portfolio.buy('AAPL', 10000, 150, Date.now()); // $1.5M, too expensive

      expect(trade).toBeNull();
      expect(portfolio.getCash()).toBe(initialCapital);
    });

    test('should reject zero quantity', () => {
      const trade = portfolio.buy('AAPL', 0, 150, Date.now());
      expect(trade).toBeNull();
    });
  });

  describe('sell', () => {
    beforeEach(() => {
      portfolio.buy('AAPL', 100, 150, Date.now() - 86400000); // Buy yesterday
    });

    test('should execute sell order', () => {
      const trade = portfolio.sell('AAPL', 50, 160, Date.now());

      expect(trade).not.toBeNull();
      expect(trade!.side).toBe('sell');
      expect(trade!.quantity).toBe(50);
      expect(trade!.status).toBe('filled');
    });

    test('should add proceeds to cash', () => {
      const cashAfterBuy = portfolio.getCash();
      portfolio.sell('AAPL', 50, 160, Date.now());

      expect(portfolio.getCash()).toBeGreaterThan(cashAfterBuy);
    });

    test('should calculate P&L', () => {
      const trade = portfolio.sell('AAPL', 50, 180, Date.now());

      expect(trade!.pnl).toBeDefined();
      expect(trade!.pnl!).toBeGreaterThan(0); // Sold higher than bought
    });

    test('should calculate holding period', () => {
      const trade = portfolio.sell('AAPL', 50, 160, Date.now());

      expect(trade!.holdingPeriodDays).toBeDefined();
      expect(trade!.holdingPeriodDays!).toBeGreaterThanOrEqual(1);
    });

    test('should reduce position', () => {
      portfolio.sell('AAPL', 50, 160, Date.now());

      const position = portfolio.getPosition('AAPL');
      expect(position!.quantity).toBe(50);
    });

    test('should close position on full sell', () => {
      portfolio.sell('AAPL', 100, 160, Date.now());

      const position = portfolio.getPosition('AAPL');
      expect(position).toBeUndefined();
    });

    test('should not sell more than owned', () => {
      const trade = portfolio.sell('AAPL', 200, 160, Date.now());

      expect(trade!.quantity).toBe(100); // Only sold what we had
    });

    test('should reject sell without position', () => {
      const trade = portfolio.sell('GOOGL', 50, 100, Date.now());
      expect(trade).toBeNull();
    });
  });

  describe('commission calculation', () => {
    test('should apply percentage commission', () => {
      const commission = portfolio.calculateCommission(100, 150);

      // Default is 0.1% = 15 for $15,000 trade
      expect(commission).toBeCloseTo(15, 0);
    });

    test('should apply minimum commission', () => {
      const customPortfolio = new Portfolio(initialCapital, {
        ...DEFAULT_COMMISSION,
        minCommission: 5,
      });

      const commission = customPortfolio.calculateCommission(1, 10);
      expect(commission).toBeGreaterThanOrEqual(5);
    });

    test('should apply maximum commission', () => {
      const customPortfolio = new Portfolio(initialCapital, {
        ...DEFAULT_COMMISSION,
        maxCommission: 10,
      });

      const commission = customPortfolio.calculateCommission(1000, 150);
      expect(commission).toBe(10);
    });
  });

  describe('closeAll', () => {
    test('should close all positions', () => {
      portfolio.buy('AAPL', 50, 150, Date.now());
      portfolio.buy('GOOGL', 30, 100, Date.now());

      const prices = new Map([
        ['AAPL', 160],
        ['GOOGL', 110],
      ]);

      const trades = portfolio.closeAll(prices, Date.now());

      expect(trades).toHaveLength(2);
      expect(portfolio.getPositions()).toHaveLength(0);
    });
  });

  describe('updatePrices', () => {
    test('should update unrealized P&L', () => {
      portfolio.buy('AAPL', 100, 150, Date.now());

      const prices = new Map([['AAPL', 180]]);
      portfolio.updatePrices(prices, Date.now());

      const position = portfolio.getPosition('AAPL');
      expect(position!.currentPrice).toBe(180);
      expect(position!.unrealizedPnl).toBeGreaterThan(0);
    });
  });

  describe('getTotalValue', () => {
    test('should return cash when no positions', () => {
      expect(portfolio.getTotalValue()).toBe(initialCapital);
    });

    test('should include position value', () => {
      portfolio.buy('AAPL', 100, 150, Date.now());

      const value = portfolio.getTotalValue();
      // Should be close to initial (some lost to commission/slippage)
      expect(value).toBeLessThan(initialCapital);
      expect(value).toBeGreaterThan(initialCapital * 0.99);
    });
  });

  describe('reset', () => {
    test('should reset to initial state', () => {
      portfolio.buy('AAPL', 100, 150, Date.now());
      portfolio.reset(50000);

      expect(portfolio.getCash()).toBe(50000);
      expect(portfolio.getPositions()).toHaveLength(0);
      expect(portfolio.getTrades()).toHaveLength(0);
    });
  });
});
