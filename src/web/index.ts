/**
 * Web Module
 * REST API server with Hono
 */

// Types
export type {
  ApiResponse,
  ApiError,
  ResponseMeta,
  PaginationParams,
  PaginatedResponse,
  QuoteResponse,
  HistoricalBar,
  FactorResponse,
  ScreenResult,
  StrategyInfo,
  BacktestResponse,
  SentimentResponse,
  ChatResponseData,
  PortfolioResponse,
  OrderResponse,
  HealthResponse,
  HistoricalRequest,
  FactorRequest,
  ScreenRequest,
  BacktestRequest,
  SentimentRequest,
  ChatRequest,
  OrderRequest,
} from './types';

// Schemas
export {
  symbolSchema,
  paginationSchema,
  dateRangeSchema,
  historicalRequestSchema,
  factorRequestSchema,
  screenRequestSchema,
  backtestRequestSchema,
  sentimentRequestSchema,
  chatRequestSchema,
  orderRequestSchema,
} from './types';

// Middleware
export {
  requestId,
  logger,
  errorHandler,
  cors,
  rateLimit,
  responseTime,
  errorResponse,
  successResponse,
  paginatedResponse,
  type LoggerConfig,
  type CorsConfig,
  type RateLimitConfig,
} from './middleware';

// Routes
export {
  healthRouter,
  marketRouter,
  factorRouter,
  strategyRouter,
  aiRouter,
  portfolioRouter,
  createApp,
} from './routes';

// Server
export { createServer, startServer, type ServerConfig } from './server';
