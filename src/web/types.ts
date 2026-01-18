/**
 * API Types
 * Type definitions for REST API
 */

import { z } from 'zod';

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

/** Pagination params */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ============ Zod Schemas ============

/** Symbol parameter schema */
export const symbolSchema = z.string().min(1).max(10).toUpperCase();

/** Pagination schema */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Date range schema */
export const dateRangeSchema = z.object({
  startDate: z.coerce.number().optional(),
  endDate: z.coerce.number().optional(),
});

/** Historical data request schema */
export const historicalRequestSchema = z.object({
  symbol: symbolSchema,
  startDate: z.coerce.number().optional(),
  endDate: z.coerce.number().optional(),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w']).default('1d'),
});

/** Factor request schema */
export const factorRequestSchema = z.object({
  symbol: symbolSchema,
  categories: z.array(z.string()).optional(),
});

/** Screen request schema */
export const screenRequestSchema = z.object({
  factors: z.array(
    z.object({
      name: z.string(),
      min: z.number().optional(),
      max: z.number().optional(),
      weight: z.number().default(1),
    })
  ),
  symbols: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

/** Backtest request schema */
export const backtestRequestSchema = z.object({
  strategyId: z.string(),
  symbols: z.array(z.string()).min(1),
  startDate: z.coerce.number(),
  endDate: z.coerce.number(),
  initialCapital: z.number().positive().default(100000),
  config: z
    .object({
      maxPositions: z.number().int().min(1).max(100).optional(),
      positionSizing: z
        .enum(['equal_weight', 'percent', 'fixed', 'kelly'])
        .optional(),
      rebalanceFrequency: z
        .enum(['daily', 'weekly', 'monthly', 'quarterly', 'never'])
        .optional(),
    })
    .optional(),
});

/** Sentiment request schema */
export const sentimentRequestSchema = z.object({
  text: z.string().min(1).max(10000),
});

/** Chat request schema */
export const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z
    .object({
      portfolioId: z.string().optional(),
      symbols: z.array(z.string()).optional(),
    })
    .optional(),
});

/** Order request schema */
export const orderRequestSchema = z.object({
  portfolioId: z.string(),
  symbol: symbolSchema,
  side: z.enum(['buy', 'sell']),
  quantity: z.number().positive(),
  type: z.enum(['market', 'limit']).default('market'),
  limitPrice: z.number().positive().optional(),
});

// ============ Response Types ============

/** Quote response */
export interface QuoteResponse {
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

/** Factor data response */
export interface FactorResponse {
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
export interface StrategyInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: Array<{
    name: string;
    type: string;
    default: unknown;
    description: string;
  }>;
}

/** Backtest result response */
export interface BacktestResponse {
  id: string;
  strategyId: string;
  strategyName: string;
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
  };
  equityCurve: Array<{ date: number; equity: number }>;
  trades: Array<{
    timestamp: number;
    symbol: string;
    side: string;
    quantity: number;
    price: number;
    pnl?: number;
  }>;
}

/** Sentiment response */
export interface SentimentResponse {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
  confidence: number;
  keyPhrases: string[];
}

/** Chat response */
export interface ChatResponseData {
  message: string;
  suggestions?: string[];
}

/** Portfolio response */
export interface PortfolioResponse {
  id: string;
  name: string;
  cash: number;
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
  }>;
}

/** Order response */
export interface OrderResponse {
  id: string;
  portfolioId: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  filledAt?: number;
}

/** Health check response */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: Record<string, { status: string; latency?: number }>;
}

// ============ Type Inference ============

export type HistoricalRequest = z.infer<typeof historicalRequestSchema>;
export type FactorRequest = z.infer<typeof factorRequestSchema>;
export type ScreenRequest = z.infer<typeof screenRequestSchema>;
export type BacktestRequest = z.infer<typeof backtestRequestSchema>;
export type SentimentRequest = z.infer<typeof sentimentRequestSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type OrderRequest = z.infer<typeof orderRequestSchema>;
