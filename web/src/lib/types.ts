/**
 * API Types
 * Type definitions for the MaxTrade API
 */

/** Standard API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/** API error details */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** Response metadata */
export interface ResponseMeta {
  timestamp: number;
  requestId: string;
  duration?: number;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/** Quote data */
export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

/** Historical bar */
export interface HistoricalBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Factor data */
export interface FactorData {
  symbol: string;
  timestamp: number;
  factors: Record<string, number>;
  categories: Record<string, Record<string, number>>;
}

/** Screen result */
export interface ScreenResult {
  symbol: string;
  score: number;
  factors: Record<string, number>;
  rank: number;
}

/** Strategy info */
export interface Strategy {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: StrategyParameter[];
}

/** Strategy parameter */
export interface StrategyParameter {
  name: string;
  type: string;
  default: unknown;
  description: string;
}

/** Backtest result */
export interface BacktestResult {
  id: string;
  strategyId: string;
  strategyName: string;
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
}

/** Backtest metrics */
export interface BacktestMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
}

/** Equity curve point */
export interface EquityPoint {
  date: number;
  equity: number;
}

/** Backtest trade */
export interface BacktestTrade {
  timestamp: number;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  pnl?: number;
}

/** Sentiment result */
export interface SentimentResult {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
  confidence: number;
  keyPhrases: string[];
}

/** Chat response */
export interface ChatResponse {
  message: string;
  suggestions?: string[];
}

/** Portfolio */
export interface Portfolio {
  id: string;
  name: string;
  cash: number;
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  positions: Position[];
}

/** Position */
export interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

/** Order */
export interface Order {
  id: string;
  portfolioId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  filledAt?: number;
}

/** Trade record */
export interface Trade {
  id: string;
  portfolioId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: number;
  pnl?: number;
}

/** Health status */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: Record<string, { status: string; latency?: number }>;
}
