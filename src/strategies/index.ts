/**
 * Strategy Framework Module
 * Extensible trading strategy system
 */

// Types
export type {
  Strategy,
  StrategyRegistry,
  StrategyInput,
  StrategyResult,
  StrategyParams,
  ParamDefinition,
  Signal,
  FactorContribution,
  TradeAction,
  RiskLevel,
  SignalFilter,
  Allocation,
} from './types';

// Base
export { BaseStrategy } from './base';

// Registry
export { strategyRegistry, initializeBuiltinStrategies } from './registry';

// Built-in strategies
export {
  MomentumStrategy,
  ValueStrategy,
  QualityGrowthStrategy,
  MultiFactorStrategy,
  MeanReversionStrategy,
  LowVolatilityStrategy,
} from './builtin';
