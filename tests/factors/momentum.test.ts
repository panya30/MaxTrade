/**
 * Momentum Factors Tests
 */

import { describe, test, expect } from 'bun:test';
import {
  calculatePriceMomentum,
  calculateMomentumAcceleration,
  calculateVolumeMomentum,
  calculateRSI,
  calculateMACD,
  calculateMomentumFactors,
} from '../../src/factors/momentum';
import type { PriceData } from '../../src/factors/types';

describe('calculatePriceMomentum', () => {
  test('should calculate positive momentum', () => {
    const prices = Array(25).fill(100).map((v, i) => v + i * 2); // 100, 102, 104...
    const result = calculatePriceMomentum(prices, 20);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  test('should calculate negative momentum', () => {
    const prices = Array(25).fill(200).map((v, i) => v - i * 2); // 200, 198, 196...
    const result = calculatePriceMomentum(prices, 20);
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(0);
  });

  test('should return null for insufficient data', () => {
    expect(calculatePriceMomentum([100, 110], 20)).toBeNull();
  });

  test('should calculate correct percentage', () => {
    const prices = Array(25).fill(0).map((_, i) => i < 20 ? 100 : 120);
    // Price went from 100 to 120 = 20% gain
    const result = calculatePriceMomentum(prices, 20);
    expect(result).toBeCloseTo(20, 1);
  });
});

describe('calculateMomentumAcceleration', () => {
  test('should detect accelerating momentum', () => {
    // Slow growth then fast growth
    const prices = [
      ...Array(21).fill(100).map((v, i) => v + i), // 100-120 (+20)
      ...Array(20).fill(120).map((v, i) => v + i * 2), // 120-158 (+38)
    ];
    const result = calculateMomentumAcceleration(prices, 20);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0); // Acceleration is positive
  });

  test('should detect decelerating momentum', () => {
    // Fast growth then slow growth
    const prices = [
      ...Array(21).fill(100).map((v, i) => v + i * 2), // 100-140 (+40)
      ...Array(20).fill(140).map((v, i) => v + i), // 140-159 (+19)
    ];
    const result = calculateMomentumAcceleration(prices, 20);
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(0); // Deceleration is negative
  });
});

describe('calculateVolumeMomentum', () => {
  test('should detect above-average volume', () => {
    const volumes = [...Array(20).fill(1000), 1500]; // Average 1000, current 1500
    const result = calculateVolumeMomentum(volumes, 20);
    expect(result).not.toBeNull();
    expect(result!).toBe(50); // 50% above average
  });

  test('should detect below-average volume', () => {
    const volumes = [...Array(20).fill(1000), 500]; // Average 1000, current 500
    const result = calculateVolumeMomentum(volumes, 20);
    expect(result).not.toBeNull();
    expect(result!).toBe(-50); // 50% below average
  });
});

describe('calculateRSI', () => {
  test('should return ~50 for sideways market', () => {
    // Alternating up and down
    const prices = Array(30).fill(100).map((v, i) => v + (i % 2 === 0 ? 1 : -1));
    const result = calculateRSI(prices, 14);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(40);
    expect(result!).toBeLessThan(60);
  });

  test('should return high RSI for strong uptrend', () => {
    const prices = Array(30).fill(100).map((v, i) => v + i * 2);
    const result = calculateRSI(prices, 14);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(70);
  });

  test('should return low RSI for strong downtrend', () => {
    const prices = Array(30).fill(200).map((v, i) => v - i * 2);
    const result = calculateRSI(prices, 14);
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(30);
  });

  test('should return 100 for all gains', () => {
    const prices = Array(20).fill(0).map((_, i) => 100 + i);
    const result = calculateRSI(prices, 14);
    expect(result).toBe(100);
  });
});

describe('calculateMACD', () => {
  test('should calculate MACD components', () => {
    const prices = Array(50).fill(100).map((v, i) => v + Math.sin(i / 5) * 10);
    const result = calculateMACD(prices);

    expect(result.macd).not.toBeNull();
    expect(result.macd_signal).not.toBeNull();
    expect(result.macd_histogram).not.toBeNull();
  });

  test('should show positive MACD in uptrend', () => {
    const prices = Array(50).fill(100).map((v, i) => v + i);
    const result = calculateMACD(prices);

    expect(result.macd).not.toBeNull();
    expect(result.macd!).toBeGreaterThan(0);
  });

  test('should return nulls for insufficient data', () => {
    const result = calculateMACD([100, 110, 120]);
    expect(result.macd).toBeNull();
    expect(result.macd_signal).toBeNull();
  });
});

describe('calculateMomentumFactors', () => {
  const generatePriceData = (count: number): PriceData[] => {
    return Array(count)
      .fill(0)
      .map((_, i) => ({
        timestamp: Date.now() - (count - i) * 86400000,
        open: 100 + i,
        high: 102 + i,
        low: 99 + i,
        close: 101 + i,
        volume: 1000000 + i * 10000,
      }));
  };

  test('should calculate all momentum factors', () => {
    const prices = generatePriceData(300);
    const result = calculateMomentumFactors(prices);

    expect(result.momentum_20d).not.toBeNull();
    expect(result.momentum_60d).not.toBeNull();
    expect(result.momentum_252d).not.toBeNull();
    expect(result.rsi_14).not.toBeNull();
    expect(result.macd).not.toBeNull();
    expect(result.volume_momentum_20d).not.toBeNull();
  });

  test('should handle insufficient data gracefully', () => {
    const prices = generatePriceData(10);
    const result = calculateMomentumFactors(prices);

    // Short-term should work
    expect(result.rsi_14).toBeNull(); // Needs 15+ days
    expect(result.momentum_252d).toBeNull(); // Needs 253+ days
  });
});
