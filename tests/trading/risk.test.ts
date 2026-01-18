/**
 * Risk Manager Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Portfolio } from '../../src/trading/portfolio';
import { RiskManager } from '../../src/trading/risk';
import type { PriceProvider, OrderRequest } from '../../src/trading/types';

describe('RiskManager', () => {
  let portfolio: Portfolio;
  let riskManager: RiskManager;
  let mockPriceProvider: PriceProvider;

  beforeEach(() => {
    portfolio = new Portfolio('Test', {
      initialCash: 100000,
      minCashReserve: 0.05,
    });

    mockPriceProvider = {
      getPrice: async () => 100,
      getPrices: async (symbols: string[]) => {
        return new Map(symbols.map((s) => [s, 100]));
      },
    };

    riskManager = new RiskManager(mockPriceProvider, {
      maxPositionPct: 0.2, // 20%
      maxPositionValue: 30000,
      maxDailyLossPct: 0.05,
      maxDrawdownPct: 0.15,
      maxPositions: 10,
      minCashReservePct: 0.05,
      maxConcentrationPct: 0.25,
    });
  });

  describe('position size checks', () => {
    test('should allow order within position limit', async () => {
      const request: OrderRequest = {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 100, // 10k = 10%
        type: 'market',
      };

      const result = await riskManager.checkOrder(portfolio, request);

      expect(result.allowed).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should reject order exceeding position limit', async () => {
      const request: OrderRequest = {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 250, // 25k = 25% > 20%
        type: 'market',
      };

      const result = await riskManager.checkOrder(portfolio, request);

      expect(result.allowed).toBe(false);
      expect(result.errors.some((e) => e.includes('Position size'))).toBe(true);
    });

    test('should warn when approaching position limit', async () => {
      const request: OrderRequest = {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 170, // 17k = 17% (above 80% of 20%)
        type: 'market',
      };

      const result = await riskManager.checkOrder(portfolio, request);

      expect(result.allowed).toBe(true);
      expect(result.warnings.some((w) => w.includes('approaching'))).toBe(true);
    });
  });

  describe('position value checks', () => {
    test('should reject order exceeding max position value', async () => {
      const request: OrderRequest = {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 400, // 40k > 30k limit
        type: 'market',
      };

      const result = await riskManager.checkOrder(portfolio, request);

      expect(result.allowed).toBe(false);
      expect(result.errors.some((e) => e.includes('Position value'))).toBe(true);
    });
  });

  describe('position count checks', () => {
    test('should reject when at max positions', async () => {
      // Create 10 positions
      for (let i = 0; i < 10; i++) {
        portfolio.buy(`SYM${i}`, 10, 100, `ord${i}`);
      }

      const request: OrderRequest = {
        symbol: 'NEW',
        side: 'buy',
        quantity: 10,
        type: 'market',
      };

      const result = await riskManager.checkOrder(portfolio, request);

      expect(result.allowed).toBe(false);
      expect(result.errors.some((e) => e.includes('Maximum number'))).toBe(true);
    });

    test('should allow adding to existing position at max count', async () => {
      // Create 10 positions
      for (let i = 0; i < 10; i++) {
        portfolio.buy(`SYM${i}`, 10, 100, `ord${i}`);
      }

      // Add to existing position
      const request: OrderRequest = {
        symbol: 'SYM0',
        side: 'buy',
        quantity: 5,
        type: 'market',
      };

      const result = await riskManager.checkOrder(portfolio, request);

      expect(result.errors.some((e) => e.includes('Maximum number'))).toBe(false);
    });
  });

  describe('cash reserve checks', () => {
    test('should reject if would breach minimum reserve', async () => {
      // Buy to use most cash
      portfolio.buy('AAPL', 900, 100, 'ord1'); // Use 90k

      const request: OrderRequest = {
        symbol: 'GOOGL',
        side: 'buy',
        quantity: 60, // 6k + commission would breach 5% reserve
        type: 'market',
      };

      const result = await riskManager.checkOrder(portfolio, request);

      expect(result.allowed).toBe(false);
      expect(result.errors.some((e) => e.includes('reserve') || e.includes('buying power'))).toBe(true);
    });
  });

  describe('concentration checks', () => {
    test('should reject high concentration', async () => {
      const request: OrderRequest = {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 300, // 30k = 30% > 25% concentration limit
        type: 'market',
      };

      const result = await riskManager.checkOrder(portfolio, request);

      expect(result.allowed).toBe(false);
      expect(result.errors.some((e) => e.includes('Concentration'))).toBe(true);
    });
  });

  describe('sell order checks', () => {
    test('should allow valid sell', async () => {
      portfolio.buy('AAPL', 100, 100, 'ord1');

      const request: OrderRequest = {
        symbol: 'AAPL',
        side: 'sell',
        quantity: 50,
        type: 'market',
      };

      const result = await riskManager.checkOrder(portfolio, request);

      expect(result.allowed).toBe(true);
    });

    test('should reject sell without position', async () => {
      const request: OrderRequest = {
        symbol: 'AAPL',
        side: 'sell',
        quantity: 10,
        type: 'market',
      };

      const result = await riskManager.checkOrder(portfolio, request);

      expect(result.allowed).toBe(false);
      expect(result.errors.some((e) => e.includes('No position'))).toBe(true);
    });

    test('should reject sell exceeding position', async () => {
      portfolio.buy('AAPL', 100, 100, 'ord1');

      const request: OrderRequest = {
        symbol: 'AAPL',
        side: 'sell',
        quantity: 150,
        type: 'market',
      };

      const result = await riskManager.checkOrder(portfolio, request);

      expect(result.allowed).toBe(false);
      expect(result.errors.some((e) => e.includes('Insufficient shares'))).toBe(true);
    });
  });

  describe('limit configuration', () => {
    test('should return current limits', () => {
      const limits = riskManager.getLimits();

      expect(limits.maxPositionPct).toBe(0.2);
      expect(limits.maxPositions).toBe(10);
    });

    test('should update limits', () => {
      riskManager.setLimits({ maxPositions: 15 });
      const limits = riskManager.getLimits();

      expect(limits.maxPositions).toBe(15);
    });
  });

  describe('portfolio risk summary', () => {
    test('should return risk summary', () => {
      portfolio.buy('AAPL', 100, 100, 'ord1');
      portfolio.buy('GOOGL', 50, 100, 'ord2');

      const summary = riskManager.getPortfolioRiskSummary(portfolio);

      expect(summary.positionCount).toBe(2);
      expect(summary.maxPositionPct).toBeGreaterThan(0);
      expect(summary.largestPosition).toBeDefined();
      expect(summary.cashReservePct).toBeGreaterThan(0);
    });

    test('should identify violations', async () => {
      // Create many positions
      for (let i = 0; i < 10; i++) {
        portfolio.buy(`SYM${i}`, 10, 100, `ord${i}`);
      }

      const summary = riskManager.getPortfolioRiskSummary(portfolio);

      expect(summary.violations.some((v) => v.includes('positions'))).toBe(true);
    });
  });

  describe('max shares calculation', () => {
    test('should calculate max purchasable shares', async () => {
      const maxShares = await riskManager.calculateMaxShares(portfolio, 'AAPL');

      expect(maxShares).toBeGreaterThan(0);
      expect(maxShares).toBeLessThanOrEqual(200); // Limited by 20% position size
    });

    test('should consider existing position', async () => {
      portfolio.buy('AAPL', 100, 100, 'ord1'); // 10k existing

      const maxShares = await riskManager.calculateMaxShares(portfolio, 'AAPL');

      // Max position is 20% = 20k, already have 10k, so max additional is ~100 shares
      expect(maxShares).toBeLessThanOrEqual(100);
    });

    test('should accept custom price', async () => {
      const maxShares = await riskManager.calculateMaxShares(portfolio, 'AAPL', 50);

      // At $50/share, can buy more shares
      expect(maxShares).toBeGreaterThan(200);
    });
  });
});
