/**
 * Test Utilities
 * Common helpers and mocks for testing
 */

import type { PriceProvider } from '../../src/trading/types';

/**
 * Create a mock price provider for testing
 */
export function createMockPriceProvider(
  prices: Record<string, number> = {}
): PriceProvider {
  const priceMap = new Map(Object.entries(prices));

  return {
    async getPrice(symbol: string): Promise<number> {
      return priceMap.get(symbol) ?? 100;
    },

    async getPrices(symbols: string[]): Promise<Map<string, number>> {
      const result = new Map<string, number>();
      for (const symbol of symbols) {
        const price = priceMap.get(symbol);
        if (price !== undefined) {
          result.set(symbol, price);
        }
      }
      return result;
    },
  };
}

/**
 * Wait for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a random string for test IDs
 */
export function randomId(prefix = 'test'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create test OHLCV data
 */
export function createTestBars(
  count: number,
  startPrice = 100,
  startTime = Date.now() - count * 86400000
): Array<{
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  const bars = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 5;
    price = Math.max(1, price + change);

    bars.push({
      timestamp: startTime + i * 86400000,
      open: price - 1,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: Math.floor(Math.random() * 1000000),
    });
  }

  return bars;
}

/**
 * Round number to specified decimal places
 */
export function round(value: number, decimals = 2): number {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

/**
 * Assert that a value is within a range
 */
export function assertInRange(
  value: number,
  min: number,
  max: number,
  message?: string
): void {
  if (value < min || value > max) {
    throw new Error(
      message ?? `Expected ${value} to be between ${min} and ${max}`
    );
  }
}

/**
 * Create a delayed function for testing async behavior
 */
export function delayed<T>(value: T, ms = 10): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
