/**
 * Portfolio Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Portfolio } from '../../src/trading/portfolio';
import type { PriceProvider } from '../../src/trading/types';

describe('Portfolio', () => {
  let portfolio: Portfolio;

  beforeEach(() => {
    portfolio = new Portfolio('Test Portfolio', { initialCash: 100000 });
  });

  describe('initialization', () => {
    test('should have correct initial values', () => {
      expect(portfolio.getCash()).toBe(100000);
      expect(portfolio.getTotalValue()).toBe(100000);
      expect(portfolio.getPositions()).toHaveLength(0);
      expect(portfolio.getTrades()).toHaveLength(0);
    });

    test('should generate unique IDs', () => {
      const p1 = new Portfolio('P1');
      const p2 = new Portfolio('P2');
      expect(p1.id).not.toBe(p2.id);
    });

    test('should accept custom ID', () => {
      const p = new Portfolio('Test', {}, 'custom-id');
      expect(p.id).toBe('custom-id');
    });

    test('should use default config values', () => {
      const config = portfolio.getConfig();
      expect(config.commissionRate).toBe(0.001);
      expect(config.maxPositionSize).toBe(0.2);
    });
  });

  describe('buying', () => {
    test('should buy shares and update cash', () => {
      const trade = portfolio.buy('AAPL', 10, 150, 'ord1');

      expect(trade).not.toBeNull();
      expect(trade?.symbol).toBe('AAPL');
      expect(trade?.side).toBe('buy');
      expect(trade?.quantity).toBe(10);
      expect(trade?.price).toBe(150);

      // Cash should be reduced by trade value + commission
      const tradeValue = 10 * 150;
      const commission = tradeValue * 0.001;
      expect(portfolio.getCash()).toBe(100000 - tradeValue - commission);
    });

    test('should create position after buying', () => {
      portfolio.buy('AAPL', 10, 150, 'ord1');

      const position = portfolio.getPosition('AAPL');
      expect(position).toBeDefined();
      expect(position?.quantity).toBe(10);
      expect(position?.avgCost).toBe(150);
      expect(position?.marketValue).toBe(1500);
    });

    test('should average cost when buying more', () => {
      portfolio.buy('AAPL', 10, 150, 'ord1');
      portfolio.buy('AAPL', 10, 160, 'ord2');

      const position = portfolio.getPosition('AAPL');
      expect(position?.quantity).toBe(20);
      expect(position?.avgCost).toBe(155); // (1500 + 1600) / 20
    });

    test('should fail if insufficient cash', () => {
      const trade = portfolio.buy('AAPL', 1000, 150, 'ord1'); // 150k > 100k
      expect(trade).toBeNull();
      expect(portfolio.getCash()).toBe(100000);
    });

    test('should record trade in history', () => {
      portfolio.buy('AAPL', 10, 150, 'ord1');

      const trades = portfolio.getTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].symbol).toBe('AAPL');
    });
  });

  describe('selling', () => {
    beforeEach(() => {
      portfolio.buy('AAPL', 10, 150, 'ord1');
    });

    test('should sell shares and update cash', () => {
      const trade = portfolio.sell('AAPL', 5, 160, 'ord2');

      expect(trade).not.toBeNull();
      expect(trade?.symbol).toBe('AAPL');
      expect(trade?.side).toBe('sell');
      expect(trade?.quantity).toBe(5);
      expect(trade?.pnl).toBeDefined();
    });

    test('should calculate P&L on sell', () => {
      const trade = portfolio.sell('AAPL', 5, 160, 'ord2');

      // Bought at 150, sold at 160 = 10 profit per share
      // 5 shares * 10 = 50 - commission
      const tradeValue = 5 * 160;
      const commission = tradeValue * 0.001;
      const expectedPnl = (160 - 150) * 5 - commission;
      expect(trade?.pnl).toBeCloseTo(expectedPnl, 2);
    });

    test('should reduce position after selling', () => {
      portfolio.sell('AAPL', 5, 160, 'ord2');

      const position = portfolio.getPosition('AAPL');
      expect(position?.quantity).toBe(5);
    });

    test('should close position when selling all', () => {
      portfolio.sell('AAPL', 10, 160, 'ord2');

      const position = portfolio.getPosition('AAPL');
      expect(position).toBeUndefined();
    });

    test('should fail if insufficient shares', () => {
      const trade = portfolio.sell('AAPL', 20, 160, 'ord2');
      expect(trade).toBeNull();
    });

    test('should fail if no position', () => {
      const trade = portfolio.sell('GOOGL', 5, 100, 'ord2');
      expect(trade).toBeNull();
    });
  });

  describe('portfolio value', () => {
    test('should calculate total value correctly', () => {
      portfolio.buy('AAPL', 10, 150, 'ord1'); // 1500 + ~1.5 commission

      const cashUsed = 10 * 150 + 10 * 150 * 0.001;
      const expectedCash = 100000 - cashUsed;
      const expectedTotal = expectedCash + 10 * 150;

      expect(portfolio.getTotalValue()).toBeCloseTo(expectedTotal, 2);
    });

    test('should track positions value', () => {
      portfolio.buy('AAPL', 10, 150, 'ord1');
      portfolio.buy('GOOGL', 5, 200, 'ord2');

      expect(portfolio.getPositionsValue()).toBe(10 * 150 + 5 * 200);
    });
  });

  describe('price updates', () => {
    test('should update positions with new prices', async () => {
      portfolio.buy('AAPL', 10, 150, 'ord1');

      const mockProvider: PriceProvider = {
        getPrice: async () => 160,
        getPrices: async () => new Map([['AAPL', 160]]),
      };

      await portfolio.updatePrices(mockProvider);

      const position = portfolio.getPosition('AAPL');
      expect(position?.currentPrice).toBe(160);
      expect(position?.unrealizedPnl).toBe(100); // 10 * (160 - 150)
    });
  });

  describe('returns calculation', () => {
    test('should calculate total return', () => {
      portfolio.buy('AAPL', 10, 150, 'ord1');
      portfolio.sell('AAPL', 10, 160, 'ord2');

      // Profit = 100 - commissions
      const totalReturn = portfolio.getTotalReturn();
      expect(totalReturn).toBeGreaterThan(0);
    });

    test('should calculate return percentage', () => {
      const returnPct = portfolio.getTotalReturnPercent();
      expect(typeof returnPct).toBe('number');
    });
  });

  describe('buying power', () => {
    test('should calculate available buying power', () => {
      const power = portfolio.getBuyingPower();
      // 100k - 5% reserve = 95k
      expect(power).toBe(95000);
    });

    test('should check affordability', () => {
      expect(portfolio.canAfford(50000)).toBe(true);
      expect(portfolio.canAfford(99000)).toBe(false); // Would leave < 5% reserve
    });
  });

  describe('drawdown', () => {
    test('should start with zero drawdown', () => {
      expect(portfolio.getDrawdown()).toBe(0);
    });

    test('should calculate drawdown after loss', () => {
      portfolio.buy('AAPL', 100, 100, 'ord1'); // 10k
      portfolio.sell('AAPL', 100, 90, 'ord2'); // Lose 1k

      const drawdown = portfolio.getDrawdown();
      expect(drawdown).toBeGreaterThan(0);
    });
  });

  describe('serialization', () => {
    test('should serialize to JSON', () => {
      portfolio.buy('AAPL', 10, 150, 'ord1');

      const json = portfolio.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('cash');
      expect(json).toHaveProperty('positions');
    });

    test('should restore from JSON', () => {
      portfolio.buy('AAPL', 10, 150, 'ord1');

      const json = portfolio.toJSON();
      const restored = Portfolio.fromJSON(json);

      expect(restored.id).toBe(portfolio.id);
      expect(restored.getCash()).toBeCloseTo(portfolio.getCash(), 2);
      expect(restored.getPosition('AAPL')?.quantity).toBe(10);
    });
  });

  describe('summary', () => {
    test('should return complete summary', () => {
      portfolio.buy('AAPL', 10, 150, 'ord1');

      const summary = portfolio.getSummary();

      expect(summary.id).toBe(portfolio.id);
      expect(summary.name).toBe('Test Portfolio');
      expect(summary.cash).toBeGreaterThan(0);
      expect(summary.totalValue).toBeGreaterThan(0);
      expect(summary.positionCount).toBe(1);
    });
  });
});
