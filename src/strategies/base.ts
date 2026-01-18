/**
 * Base Strategy Implementation
 * Abstract base class providing common functionality
 */

import type {
  Strategy,
  StrategyInput,
  StrategyResult,
  StrategyParams,
  ParamDefinition,
  RiskLevel,
  Signal,
  TradeAction,
  FactorContribution,
} from './types';
import type { FactorData } from '../factors/types';

/**
 * Abstract Base Strategy
 * Provides parameter management and utility methods
 */
export abstract class BaseStrategy implements Strategy {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly riskLevel: RiskLevel;
  abstract readonly paramDefinitions: ParamDefinition[];

  protected _parameters: StrategyParams | null = null;

  constructor() {
    // Defer parameter initialization to first access
  }

  /** Lazy initialize parameters on first access */
  protected ensureParams(): void {
    if (this._parameters === null) {
      this._parameters = this.getDefaultParams();
    }
  }

  get parameters(): StrategyParams {
    this.ensureParams();
    return { ...this._parameters! };
  }

  set parameters(params: StrategyParams) {
    this.setParams(params);
  }

  /** Abstract: Implement signal generation logic */
  abstract generateSignals(input: StrategyInput): StrategyResult;

  /** Get default parameters from definitions */
  getDefaultParams(): StrategyParams {
    const params: StrategyParams = {};
    for (const def of this.paramDefinitions) {
      params[def.name] = def.default;
    }
    return params;
  }

  /** Set parameters with validation */
  setParams(params: Partial<StrategyParams>): void {
    this.ensureParams();
    const merged = { ...this._parameters!, ...params };
    const { valid, errors } = this.validateParams(merged);

    if (!valid) {
      throw new Error(`Invalid parameters: ${errors.join(', ')}`);
    }

    this._parameters = merged;
  }

  /** Validate parameters against definitions */
  validateParams(params: StrategyParams): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const def of this.paramDefinitions) {
      const value = params[def.name];

      if (value === undefined) {
        errors.push(`Missing parameter: ${def.name}`);
        continue;
      }

      // Type validation
      if (def.type === 'number') {
        if (typeof value !== 'number') {
          errors.push(`${def.name} must be a number`);
          continue;
        }
        if (def.min !== undefined && value < def.min) {
          errors.push(`${def.name} must be >= ${def.min}`);
        }
        if (def.max !== undefined && value > def.max) {
          errors.push(`${def.name} must be <= ${def.max}`);
        }
      } else if (def.type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`${def.name} must be a string`);
        }
      } else if (def.type === 'boolean') {
        if (typeof value !== 'boolean') {
          errors.push(`${def.name} must be a boolean`);
        }
      } else if (def.type === 'select') {
        if (!def.options?.includes(value as string)) {
          errors.push(`${def.name} must be one of: ${def.options?.join(', ')}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /** Create a signal object */
  protected createSignal(
    symbol: string,
    action: TradeAction,
    confidence: number,
    strength: number,
    factors: FactorContribution[] = [],
    metadata?: Record<string, unknown>
  ): Signal {
    return {
      symbol,
      action,
      confidence: Math.max(0, Math.min(1, confidence)),
      strength,
      factors,
      timestamp: Date.now(),
      metadata,
    };
  }

  /** Create strategy result wrapper */
  protected createResult(
    signals: Signal[],
    startTime: number
  ): StrategyResult {
    return {
      strategyName: this.name,
      signals,
      timestamp: Date.now(),
      parameters: { ...this._parameters },
      executionTimeMs: Date.now() - startTime,
    };
  }

  /** Get factor value from FactorData */
  protected getFactorValue(
    factorData: FactorData,
    factorName: string
  ): number | null {
    return factorData.factors[factorName]?.value ?? null;
  }

  /** Get factor percentile from FactorData */
  protected getFactorPercentile(
    factorData: FactorData,
    factorName: string
  ): number | null {
    return factorData.factors[factorName]?.percentile ?? null;
  }

  /** Calculate weighted score from factors */
  protected calculateWeightedScore(
    factorData: FactorData,
    weights: Record<string, { weight: number; higherIsBetter: boolean }>
  ): { score: number; contributions: FactorContribution[] } {
    const contributions: FactorContribution[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    for (const [factorName, config] of Object.entries(weights)) {
      const percentile = this.getFactorPercentile(factorData, factorName);
      if (percentile === null) continue;

      // Adjust for direction
      const adjustedValue = config.higherIsBetter
        ? percentile
        : 100 - percentile;

      const contribution = adjustedValue * config.weight;
      totalScore += contribution;
      totalWeight += config.weight;

      contributions.push({
        name: factorName,
        value: percentile,
        weight: config.weight,
        contribution: contribution / 100,
      });
    }

    const score = totalWeight > 0 ? totalScore / totalWeight : 0;
    return { score, contributions };
  }

  /** Determine action from score */
  protected scoreToAction(
    score: number,
    buyThreshold: number,
    sellThreshold: number
  ): TradeAction {
    if (score >= buyThreshold) return 'buy';
    if (score <= sellThreshold) return 'sell';
    return 'hold';
  }

  /** Convert score to confidence (0-1) */
  protected scoreToConfidence(
    score: number,
    buyThreshold: number,
    sellThreshold: number
  ): number {
    const midpoint = (buyThreshold + sellThreshold) / 2;
    const range = buyThreshold - midpoint;

    if (range === 0) return 0.5;

    // Distance from midpoint normalized to 0-1
    const distance = Math.abs(score - midpoint) / range;
    return Math.min(1, distance);
  }
}
