/**
 * Order Manager Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Portfolio } from '../../src/trading/portfolio';
import { OrderManager } from '../../src/trading/orders';
import type { PriceProvider } from '../../src/trading/types';

describe('OrderManager', () => {
  let portfolio: Portfolio;
  let orderManager: OrderManager;
  let mockPriceProvider: PriceProvider;
  let prices: Map<string, number>;

  beforeEach(() => {
    portfolio = new Portfolio('Test', { initialCash: 100000 });
    prices = new Map([
      ['AAPL', 150],
      ['GOOGL', 200],
      ['MSFT', 180],
    ]);

    mockPriceProvider = {
      getPrice: async (symbol: string) => {
        return prices.get(symbol) ?? 100;
      },
      getPrices: async (symbols: string[]) => {
        const result = new Map<string, number>();
        for (const s of symbols) {
          const price = prices.get(s);
          if (price) result.set(s, price);
        }
        return result;
      },
    };

    orderManager = new OrderManager(mockPriceProvider, 0.001);
  });

  describe('market orders', () => {
    test('should execute market buy immediately', async () => {
      const result = await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'market',
      });

      expect(result.success).toBe(true);
      expect(result.order.status).toBe('filled');
      expect(result.trade).toBeDefined();
      expect(result.trade?.quantity).toBe(10);
    });

    test('should execute market sell immediately', async () => {
      // First buy
      await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'market',
      });

      // Then sell
      const result = await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'sell',
        quantity: 5,
        type: 'market',
      });

      expect(result.success).toBe(true);
      expect(result.order.status).toBe('filled');
      expect(result.trade?.side).toBe('sell');
    });

    test('should apply slippage to market orders', async () => {
      const result = await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'market',
      });

      // Buy should have higher price due to slippage
      expect(result.order.avgFillPrice).toBeGreaterThan(150);
    });

    test('should reject buy if insufficient funds', async () => {
      const result = await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 1000, // 150k > 100k
        type: 'market',
      });

      expect(result.success).toBe(false);
      expect(result.order.status).toBe('rejected');
      expect(result.error).toContain('Insufficient');
    });

    test('should reject sell if insufficient shares', async () => {
      const result = await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'sell',
        quantity: 10,
        type: 'market',
      });

      expect(result.success).toBe(false);
      expect(result.order.status).toBe('rejected');
    });
  });

  describe('limit orders', () => {
    test('should queue limit order as pending', async () => {
      const result = await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'limit',
        limitPrice: 145,
      });

      expect(result.success).toBe(true);
      expect(result.order.status).toBe('pending');
      expect(result.trade).toBeUndefined();
    });

    test('should execute limit buy when price drops', async () => {
      await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'limit',
        limitPrice: 145,
      });

      // Price drops below limit
      prices.set('AAPL', 140);

      const results = await orderManager.processPendingOrders(portfolio);

      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
      expect(results[0].order.status).toBe('filled');
    });

    test('should not execute limit buy when price is above limit', async () => {
      await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'limit',
        limitPrice: 145,
      });

      // Price stays above limit
      const results = await orderManager.processPendingOrders(portfolio);

      expect(results.length).toBe(0);
    });

    test('should execute limit sell when price rises', async () => {
      // First buy
      await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'market',
      });

      // Set limit sell
      await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'sell',
        quantity: 10,
        type: 'limit',
        limitPrice: 160,
      });

      // Price rises above limit
      prices.set('AAPL', 165);

      const results = await orderManager.processPendingOrders(portfolio);

      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
    });
  });

  describe('order management', () => {
    test('should get order by ID', async () => {
      const result = await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'market',
      });

      const order = orderManager.getOrder(result.order.id);
      expect(order).toBeDefined();
      expect(order?.id).toBe(result.order.id);
    });

    test('should get orders for portfolio', async () => {
      await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'market',
      });

      await orderManager.submitOrder(portfolio, {
        symbol: 'GOOGL',
        side: 'buy',
        quantity: 5,
        type: 'market',
      });

      const orders = orderManager.getOrdersForPortfolio(portfolio.id);
      expect(orders.length).toBe(2);
    });

    test('should get pending orders', async () => {
      await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'limit',
        limitPrice: 145,
      });

      const pending = orderManager.getPendingOrders(portfolio.id);
      expect(pending.length).toBe(1);
    });

    test('should cancel pending order', async () => {
      const result = await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'limit',
        limitPrice: 145,
      });

      const cancelled = orderManager.cancelOrder(result.order.id);
      expect(cancelled).toBe(true);

      const order = orderManager.getOrder(result.order.id);
      expect(order?.status).toBe('cancelled');
    });

    test('should not cancel filled order', async () => {
      const result = await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'market',
      });

      const cancelled = orderManager.cancelOrder(result.order.id);
      expect(cancelled).toBe(false);
    });

    test('should get orders by status', async () => {
      await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'market',
      });

      await orderManager.submitOrder(portfolio, {
        symbol: 'GOOGL',
        side: 'buy',
        quantity: 5,
        type: 'limit',
        limitPrice: 190,
      });

      const filled = orderManager.getOrdersByStatus(portfolio.id, 'filled');
      const pending = orderManager.getOrdersByStatus(portfolio.id, 'pending');

      expect(filled.length).toBe(1);
      expect(pending.length).toBe(1);
    });
  });

  describe('order details', () => {
    test('should record commission on order', async () => {
      const result = await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'market',
      });

      expect(result.order.commission).toBeGreaterThan(0);
    });

    test('should set filled timestamp', async () => {
      const result = await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'market',
      });

      expect(result.order.filledAt).toBeDefined();
      expect(result.order.filledAt).toBeGreaterThan(0);
    });

    test('should set cancelled timestamp on cancel', async () => {
      const result = await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'limit',
        limitPrice: 145,
      });

      orderManager.cancelOrder(result.order.id);
      const order = orderManager.getOrder(result.order.id);

      expect(order?.cancelledAt).toBeDefined();
    });
  });

  describe('multiple portfolios', () => {
    test('should handle orders for different portfolios', async () => {
      const portfolio2 = new Portfolio('Test2', { initialCash: 50000 });

      await orderManager.submitOrder(portfolio, {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        type: 'market',
      });

      await orderManager.submitOrder(portfolio2, {
        symbol: 'GOOGL',
        side: 'buy',
        quantity: 5,
        type: 'market',
      });

      const orders1 = orderManager.getOrdersForPortfolio(portfolio.id);
      const orders2 = orderManager.getOrdersForPortfolio(portfolio2.id);

      expect(orders1.length).toBe(1);
      expect(orders2.length).toBe(1);
      expect(orders1[0].symbol).toBe('AAPL');
      expect(orders2[0].symbol).toBe('GOOGL');
    });
  });
});
