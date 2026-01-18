/**
 * Backtesting Module
 * Commission-aware simulation with performance analytics
 */

// Types
export type {
  Trade,
  TradeSide,
  TradeStatus,
  Position,
  PortfolioSnapshot,
  CommissionConfig,
  SlippageConfig,
  BacktestConfig,
  PerformanceMetrics,
  BenchmarkComparison,
  EquityPoint,
  MonthlyReturn,
  BacktestResult,
  PriceBar,
  BacktestData,
  PositionSizing,
  RebalanceFrequency,
} from './types';

// Portfolio management
export {
  Portfolio,
  DEFAULT_COMMISSION,
  DEFAULT_SLIPPAGE,
} from './portfolio';

// Metrics calculation
export {
  calculateMetrics,
  calculateBenchmarkComparison,
  calculateMonthlyReturns,
} from './metrics';

// Engine
export {
  BacktestEngine,
  createBacktestEngine,
  DEFAULT_CONFIG,
} from './engine';
