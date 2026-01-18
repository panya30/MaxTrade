/**
 * Factor Utilities Tests
 */

import { describe, test, expect } from 'bun:test';
import {
  sma,
  ema,
  stdDev,
  returns,
  covariance,
  correlation,
  percentileRank,
  zscore,
  minMaxNorm,
  maxDrawdown,
  downsideDeviation,
  trueRange,
  safeDivide,
} from '../../src/factors/utils';

describe('sma', () => {
  test('should calculate simple moving average', () => {
    const values = [1, 2, 3, 4, 5];
    expect(sma(values, 3)).toBe(4); // (3+4+5)/3
    expect(sma(values, 5)).toBe(3); // (1+2+3+4+5)/5
  });

  test('should return null if not enough data', () => {
    expect(sma([1, 2], 5)).toBeNull();
  });
});

describe('ema', () => {
  test('should calculate exponential moving average', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = ema(values, 5);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(7); // EMA gives more weight to recent values
    expect(result!).toBeLessThan(10);
  });

  test('should return null if not enough data', () => {
    expect(ema([1, 2, 3], 5)).toBeNull();
  });
});

describe('stdDev', () => {
  test('should calculate standard deviation', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const result = stdDev(values);
    expect(result).toBeCloseTo(2, 0);
  });

  test('should return 0 for single value', () => {
    expect(stdDev([5])).toBe(0);
  });
});

describe('returns', () => {
  test('should calculate percentage returns', () => {
    const prices = [100, 110, 99, 105];
    const result = returns(prices);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(0.1, 5); // 10% gain
    expect(result[1]).toBeCloseTo(-0.1, 5); // ~10% loss
    expect(result[2]).toBeCloseTo(0.0606, 3); // ~6% gain
  });
});

describe('covariance', () => {
  test('should calculate covariance', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    const result = covariance(x, y);
    expect(result).toBeCloseTo(5, 5);
  });

  test('should return 0 for different lengths', () => {
    expect(covariance([1, 2], [1])).toBe(0);
  });
});

describe('correlation', () => {
  test('should calculate perfect positive correlation', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(correlation(x, y)).toBeCloseTo(1, 5);
  });

  test('should calculate perfect negative correlation', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 2];
    expect(correlation(x, y)).toBeCloseTo(-1, 5);
  });

  test('should return 0 for constant values', () => {
    const x = [5, 5, 5, 5, 5];
    const y = [1, 2, 3, 4, 5];
    expect(correlation(x, y)).toBe(0);
  });
});

describe('percentileRank', () => {
  test('should calculate percentile rank', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentileRank(50, values)).toBe(40);
    expect(percentileRank(100, values)).toBe(90);
    expect(percentileRank(10, values)).toBe(0);
  });

  test('should return 100 for value above all', () => {
    expect(percentileRank(200, [10, 20, 30])).toBe(100);
  });
});

describe('zscore', () => {
  test('should calculate z-score', () => {
    const values = [10, 20, 30, 40, 50];
    // Mean = 30, StdDev ≈ 15.81
    expect(zscore(30, values)).toBeCloseTo(0, 5);
    expect(zscore(50, values)).toBeGreaterThan(1);
    expect(zscore(10, values)).toBeLessThan(-1);
  });
});

describe('minMaxNorm', () => {
  test('should normalize to 0-1 range', () => {
    const values = [0, 50, 100];
    expect(minMaxNorm(0, values)).toBe(0);
    expect(minMaxNorm(50, values)).toBe(0.5);
    expect(minMaxNorm(100, values)).toBe(1);
  });

  test('should return 0.5 for equal min/max', () => {
    expect(minMaxNorm(5, [5, 5, 5])).toBe(0.5);
  });
});

describe('maxDrawdown', () => {
  test('should calculate maximum drawdown', () => {
    const prices = [100, 120, 100, 80, 90, 70, 100];
    // Peak at 120, trough at 70 = (120-70)/120 = 41.67%
    const result = maxDrawdown(prices);
    expect(result).toBeCloseTo(0.4167, 3);
  });

  test('should return 0 for always increasing prices', () => {
    expect(maxDrawdown([100, 110, 120, 130])).toBe(0);
  });
});

describe('downsideDeviation', () => {
  test('should calculate downside deviation', () => {
    const rets = [0.02, -0.03, 0.01, -0.02, 0.03, -0.05, 0.02];
    const result = downsideDeviation(rets, 0);
    expect(result).toBeGreaterThan(0);
  });

  test('should return 0 for all positive returns', () => {
    expect(downsideDeviation([0.01, 0.02, 0.03], 0)).toBe(0);
  });
});

describe('trueRange', () => {
  test('should calculate true range', () => {
    expect(trueRange(110, 90, 100)).toBe(20); // High - Low
    expect(trueRange(110, 95, 80)).toBe(30); // High - PrevClose
    expect(trueRange(85, 75, 100)).toBe(25); // PrevClose - Low
  });
});

describe('safeDivide', () => {
  test('should divide normally', () => {
    expect(safeDivide(10, 2)).toBe(5);
  });

  test('should return null for division by zero', () => {
    expect(safeDivide(10, 0)).toBeNull();
  });

  test('should return null for null inputs', () => {
    expect(safeDivide(null, 2)).toBeNull();
    expect(safeDivide(10, null)).toBeNull();
  });
});
