/**
 * Paper Trading Module
 * Simulation of trading with portfolios, orders, and risk management
 */

// Types
export type {
  OrderSide,
  OrderType,
  OrderStatus,
  OrderRequest,
  Order,
  Position,
  PortfolioConfig,
  PortfolioSummary,
  Trade,
  RiskCheckResult,
  RiskLimits,
  PortfolioAnalytics,
  PriceProvider,
} from './types';

export { DEFAULT_PORTFOLIO_CONFIG, DEFAULT_RISK_LIMITS } from './types';

// Portfolio
export { Portfolio } from './portfolio';

// Orders
export { OrderManager, type OrderResult } from './orders';

// Risk Management
export { RiskManager } from './risk';

// Analytics
export {
  calculateAnalytics,
  calculateEquityCurve,
  calculateAllocation,
  calculatePerformanceBySymbol,
} from './analytics';
