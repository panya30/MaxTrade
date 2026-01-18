/**
 * Cost Management Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  CostTracker,
  createCostTracker,
  estimateCost,
  estimateTokens,
  formatCost,
  DEFAULT_LIMITS,
} from '../../src/ai/costs';
import type { LLMResponse } from '../../src/ai/types';

describe('CostTracker', () => {
  let tracker: CostTracker;

  const createResponse = (cost: number, tokens: number, model = 'gpt-3.5-turbo'): LLMResponse => ({
    content: 'test',
    confidence: 0.9,
    tokensUsed: tokens,
    promptTokens: Math.floor(tokens * 0.7),
    completionTokens: Math.floor(tokens * 0.3),
    cost,
    model,
    latencyMs: 100,
  });

  beforeEach(() => {
    tracker = createCostTracker();
  });

  describe('record', () => {
    test('should track request count', () => {
      tracker.record(createResponse(0.01, 100));
      tracker.record(createResponse(0.02, 200));

      const stats = tracker.getDailyStats();
      expect(stats.totalRequests).toBe(2);
    });

    test('should track total cost', () => {
      tracker.record(createResponse(0.01, 100));
      tracker.record(createResponse(0.02, 200));

      const stats = tracker.getDailyStats();
      expect(stats.totalCost).toBeCloseTo(0.03, 4);
    });

    test('should track total tokens', () => {
      tracker.record(createResponse(0.01, 100));
      tracker.record(createResponse(0.02, 200));

      const stats = tracker.getDailyStats();
      expect(stats.totalTokens).toBe(300);
    });

    test('should track by model', () => {
      tracker.record(createResponse(0.01, 100, 'gpt-3.5-turbo'));
      tracker.record(createResponse(0.05, 100, 'gpt-4'));
      tracker.record(createResponse(0.02, 200, 'gpt-3.5-turbo'));

      const stats = tracker.getDailyStats();
      expect(stats.requestsByModel.get('gpt-3.5-turbo')).toBe(2);
      expect(stats.requestsByModel.get('gpt-4')).toBe(1);
      expect(stats.costByModel.get('gpt-3.5-turbo')).toBeCloseTo(0.03, 4);
      expect(stats.costByModel.get('gpt-4')).toBeCloseTo(0.05, 4);
    });

    test('should track monthly and daily separately', () => {
      tracker.record(createResponse(0.01, 100));

      const daily = tracker.getDailyStats();
      const monthly = tracker.getMonthlyStats();

      expect(daily.totalRequests).toBe(1);
      expect(monthly.totalRequests).toBe(1);
    });
  });

  describe('canMakeRequest', () => {
    test('should allow request under limits', () => {
      const result = tracker.canMakeRequest(0.01);
      expect(result.allowed).toBe(true);
    });

    test('should block request exceeding per-request limit', () => {
      const result = tracker.canMakeRequest(1.0); // Default max is 0.5

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('per-request limit');
      expect(result.suggestFallback).toBe(true);
    });

    test('should block request exceeding daily limit', () => {
      // Consume most of daily budget
      tracker.record(createResponse(9.6, 1000));

      const result = tracker.canMakeRequest(0.45); // Would exceed $10 daily (9.6 + 0.45 > 10)

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('daily limit');
    });

    test('should block request exceeding monthly limit', () => {
      // Use a tracker with higher daily limit to hit monthly first
      const customTracker = createCostTracker({
        maxDaily: 200, // High daily limit
        maxMonthly: 50, // Low monthly limit
      });

      // Consume most of monthly budget
      customTracker.record(createResponse(49.6, 10000));

      const result = customTracker.canMakeRequest(0.45); // Would exceed $50 monthly

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('monthly limit');
    });
  });

  describe('isApproachingLimit', () => {
    test('should detect approaching daily limit', () => {
      tracker.record(createResponse(8.5, 1000)); // 85% of $10

      const status = tracker.isApproachingLimit();

      expect(status.daily).toBe(true);
      expect(status.dailyPercent).toBeGreaterThan(80);
    });

    test('should detect approaching monthly limit', () => {
      tracker.record(createResponse(85, 10000)); // 85% of $100

      const status = tracker.isApproachingLimit();

      expect(status.monthly).toBe(true);
      expect(status.monthlyPercent).toBeGreaterThan(80);
    });

    test('should not warn when under threshold', () => {
      tracker.record(createResponse(1, 100)); // 10% of daily

      const status = tracker.isApproachingLimit();

      expect(status.daily).toBe(false);
      expect(status.monthly).toBe(false);
    });
  });

  describe('getRemainingBudget', () => {
    test('should calculate remaining budget', () => {
      tracker.record(createResponse(3, 1000));

      const remaining = tracker.getRemainingBudget();

      expect(remaining.daily).toBeCloseTo(7, 0); // $10 - $3
      expect(remaining.monthly).toBeCloseTo(97, 0); // $100 - $3
    });

    test('should not go negative', () => {
      tracker.record(createResponse(15, 10000)); // Exceeds daily limit

      const remaining = tracker.getRemainingBudget();

      expect(remaining.daily).toBe(0);
    });
  });

  describe('reset', () => {
    test('should reset daily stats', () => {
      tracker.record(createResponse(1, 100));
      tracker.resetDaily();

      const stats = tracker.getDailyStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalCost).toBe(0);
    });

    test('should preserve monthly stats on daily reset', () => {
      tracker.record(createResponse(1, 100));
      tracker.resetDaily();

      const monthly = tracker.getMonthlyStats();
      expect(monthly.totalRequests).toBe(1);
    });

    test('should reset monthly stats', () => {
      tracker.record(createResponse(1, 100));
      tracker.resetMonthly();

      const stats = tracker.getMonthlyStats();
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('limits', () => {
    test('should use custom limits', () => {
      const customTracker = createCostTracker({
        maxDaily: 5,
        maxMonthly: 50,
      });

      const limits = customTracker.getLimits();
      expect(limits.maxDaily).toBe(5);
      expect(limits.maxMonthly).toBe(50);
    });

    test('should update limits', () => {
      tracker.setLimits({ maxDaily: 20 });

      const limits = tracker.getLimits();
      expect(limits.maxDaily).toBe(20);
      expect(limits.maxMonthly).toBe(DEFAULT_LIMITS.maxMonthly);
    });
  });

  describe('fallback model', () => {
    test('should return fallback model', () => {
      const model = tracker.getFallbackModel();
      expect(model).toBe('gpt-3.5-turbo');
    });

    test('should use custom fallback', () => {
      const customTracker = createCostTracker({
        fallbackModel: 'gpt-4-turbo',
      });

      expect(customTracker.getFallbackModel()).toBe('gpt-4-turbo');
    });
  });
});

describe('estimateCost', () => {
  test('should estimate GPT-3.5 cost', () => {
    const cost = estimateCost(1000, 500, 'gpt-3.5-turbo');

    // 1000 * 0.0005 / 1000 + 500 * 0.0015 / 1000 = 0.0005 + 0.00075 = 0.00125
    expect(cost).toBeCloseTo(0.00125, 5);
  });

  test('should estimate GPT-4 cost', () => {
    const cost = estimateCost(1000, 500, 'gpt-4');

    // 1000 * 0.03 / 1000 + 500 * 0.06 / 1000 = 0.03 + 0.03 = 0.06
    expect(cost).toBeCloseTo(0.06, 4);
  });

  test('should default to GPT-3.5 pricing for unknown models', () => {
    const cost = estimateCost(1000, 500, 'unknown-model');
    const gpt35Cost = estimateCost(1000, 500, 'gpt-3.5-turbo');

    expect(cost).toBe(gpt35Cost);
  });
});

describe('estimateTokens', () => {
  test('should estimate tokens from text length', () => {
    const text = 'This is a test string for token estimation';
    const tokens = estimateTokens(text);

    // ~4 chars per token, text is 43 chars = ~11 tokens
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(text.length);
  });

  test('should handle empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('formatCost', () => {
  test('should format small costs in cents', () => {
    const formatted = formatCost(0.005);
    expect(formatted).toContain('¢');
  });

  test('should format larger costs in dollars', () => {
    const formatted = formatCost(0.05);
    expect(formatted).toContain('$');
    expect(formatted).not.toContain('¢');
  });

  test('should format with precision', () => {
    const formatted = formatCost(0.1234);
    expect(formatted).toBe('$0.1234');
  });
});
