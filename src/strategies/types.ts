/**
 * Strategy Framework Types
 * Extensible strategy system with signal generation
 */

import type { FactorData, PriceData } from '../factors/types';

/** Risk level classification */
export type RiskLevel = 'low' | 'medium' | 'high';

/** Trading action */
export type TradeAction = 'buy' | 'sell' | 'hold';

/** Factor contribution to signal */
export interface FactorContribution {
  name: string;
  value: number;
  weight: number;
  contribution: number; // value * weight
}

/** Trading signal */
export interface Signal {
  symbol: string;
  action: TradeAction;
  confidence: number; // 0-1
  strength: number; // raw score
  factors: FactorContribution[];
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/** Strategy parameter definition */
export interface ParamDefinition {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'select';
  default: unknown;
  min?: number;
  max?: number;
  options?: string[];
  description: string;
}

/** Strategy parameters */
export type StrategyParams = Record<string, unknown>;

/** Strategy result from signal generation */
export interface StrategyResult {
  strategyName: string;
  signals: Signal[];
  timestamp: number;
  parameters: StrategyParams;
  executionTimeMs: number;
  metadata?: Record<string, unknown>;
}

/** Input data for strategy execution */
export interface StrategyInput {
  symbols: string[];
  factorData: Map<string, FactorData>;
  priceData: Map<string, PriceData[]>;
  benchmark?: PriceData[];
}

/**
 * Strategy Interface
 * Base contract for all trading strategies
 */
export interface Strategy {
  /** Unique strategy name */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /** Risk level */
  readonly riskLevel: RiskLevel;

  /** Parameter definitions */
  readonly paramDefinitions: ParamDefinition[];

  /** Current parameters */
  parameters: StrategyParams;

  /** Generate trading signals */
  generateSignals(input: StrategyInput): StrategyResult;

  /** Validate parameters */
  validateParams(params: StrategyParams): { valid: boolean; errors: string[] };

  /** Set parameters with validation */
  setParams(params: Partial<StrategyParams>): void;

  /** Get default parameters */
  getDefaultParams(): StrategyParams;
}

/**
 * Strategy Registry Interface
 */
export interface StrategyRegistry {
  /** Register a strategy class */
  register<T extends Strategy>(
    strategyClass: new () => T,
    name?: string
  ): void;

  /** Create a strategy instance */
  create(name: string, params?: StrategyParams): Strategy;

  /** Get a strategy class */
  get(name: string): (new () => Strategy) | undefined;

  /** List available strategy names */
  list(): string[];

  /** Get strategy metadata */
  getMetadata(name: string): {
    name: string;
    description: string;
    riskLevel: RiskLevel;
    paramDefinitions: ParamDefinition[];
  } | undefined;

  /** Unregister a strategy */
  unregister(name: string): boolean;
}

/** Filter options for signal generation */
export interface SignalFilter {
  minConfidence?: number;
  maxSignals?: number;
  actions?: TradeAction[];
}

/** Portfolio allocation from strategy */
export interface Allocation {
  symbol: string;
  weight: number; // 0-1
  action: TradeAction;
  signal: Signal;
}
