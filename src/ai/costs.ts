/**
 * Cost Management
 * Track and limit LLM API costs
 */

import type { UsageStats, CostLimits, LLMResponse } from './types';

/** Default cost limits */
export const DEFAULT_LIMITS: CostLimits = {
  maxPerRequest: 0.5, // $0.50 per request max
  maxDaily: 10.0, // $10 per day
  maxMonthly: 100.0, // $100 per month
  warningThreshold: 0.8, // Warn at 80% of limit
  fallbackModel: 'gpt-3.5-turbo',
};

/**
 * Cost Tracker
 * Tracks usage and enforces limits
 */
export class CostTracker {
  private limits: CostLimits;
  private dailyStats: UsageStats;
  private monthlyStats: UsageStats;

  constructor(limits: Partial<CostLimits> = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.dailyStats = this.createEmptyStats();
    this.monthlyStats = this.createEmptyStats();
  }

  /**
   * Record a completed request
   */
  record(response: LLMResponse): void {
    this.recordToStats(this.dailyStats, response);
    this.recordToStats(this.monthlyStats, response);
  }

  /**
   * Check if a request can be made
   */
  canMakeRequest(estimatedCost: number): {
    allowed: boolean;
    reason?: string;
    suggestFallback?: boolean;
  } {
    // Check per-request limit
    if (estimatedCost > this.limits.maxPerRequest) {
      return {
        allowed: false,
        reason: `Request cost ($${estimatedCost.toFixed(4)}) exceeds per-request limit ($${this.limits.maxPerRequest})`,
        suggestFallback: true,
      };
    }

    // Check daily limit
    if (this.dailyStats.totalCost + estimatedCost > this.limits.maxDaily) {
      return {
        allowed: false,
        reason: `Would exceed daily limit ($${this.limits.maxDaily})`,
        suggestFallback: true,
      };
    }

    // Check monthly limit
    if (this.monthlyStats.totalCost + estimatedCost > this.limits.maxMonthly) {
      return {
        allowed: false,
        reason: `Would exceed monthly limit ($${this.limits.maxMonthly})`,
        suggestFallback: true,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if approaching limits (warning threshold)
   */
  isApproachingLimit(): {
    daily: boolean;
    monthly: boolean;
    dailyPercent: number;
    monthlyPercent: number;
  } {
    const dailyPercent = this.dailyStats.totalCost / this.limits.maxDaily;
    const monthlyPercent =
      this.monthlyStats.totalCost / this.limits.maxMonthly;

    return {
      daily: dailyPercent >= this.limits.warningThreshold,
      monthly: monthlyPercent >= this.limits.warningThreshold,
      dailyPercent: dailyPercent * 100,
      monthlyPercent: monthlyPercent * 100,
    };
  }

  /**
   * Get daily usage stats
   */
  getDailyStats(): UsageStats {
    return { ...this.dailyStats };
  }

  /**
   * Get monthly usage stats
   */
  getMonthlyStats(): UsageStats {
    return { ...this.monthlyStats };
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): { daily: number; monthly: number } {
    return {
      daily: Math.max(0, this.limits.maxDaily - this.dailyStats.totalCost),
      monthly: Math.max(
        0,
        this.limits.maxMonthly - this.monthlyStats.totalCost
      ),
    };
  }

  /**
   * Get fallback model when approaching limits
   */
  getFallbackModel(): string | undefined {
    return this.limits.fallbackModel;
  }

  /**
   * Reset daily stats (call at start of day)
   */
  resetDaily(): void {
    this.dailyStats = this.createEmptyStats();
  }

  /**
   * Reset monthly stats (call at start of month)
   */
  resetMonthly(): void {
    this.monthlyStats = this.createEmptyStats();
  }

  /**
   * Update limits
   */
  setLimits(limits: Partial<CostLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  /**
   * Get current limits
   */
  getLimits(): CostLimits {
    return { ...this.limits };
  }

  /**
   * Record to stats object
   */
  private recordToStats(stats: UsageStats, response: LLMResponse): void {
    stats.totalRequests++;
    stats.totalTokens += response.tokensUsed;
    stats.totalCost += response.cost;

    // Track by model
    const modelRequests = stats.requestsByModel.get(response.model) ?? 0;
    stats.requestsByModel.set(response.model, modelRequests + 1);

    const modelCost = stats.costByModel.get(response.model) ?? 0;
    stats.costByModel.set(response.model, modelCost + response.cost);
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(): UsageStats {
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      requestsByModel: new Map(),
      costByModel: new Map(),
      periodStart: Date.now(),
    };
  }
}

/**
 * Estimate cost before making a request
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const costs: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  };

  const modelCosts = costs[model] ?? costs['gpt-3.5-turbo'];
  return (
    (inputTokens * modelCosts.input + outputTokens * modelCosts.output) / 1000
  );
}

/**
 * Estimate tokens from text (rough approximation)
 * Rule of thumb: ~4 characters per token for English
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(2)}¢`;
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Create cost tracker instance
 */
export function createCostTracker(
  limits: Partial<CostLimits> = {}
): CostTracker {
  return new CostTracker(limits);
}

/** Global cost tracker */
export const globalCostTracker = new CostTracker();
