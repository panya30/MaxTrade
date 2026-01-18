/**
 * Storage Module Types
 * Type definitions for database and cache layers
 */

/** Database record with timestamps */
export interface BaseRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
}

/** Market data record */
export interface MarketDataRecord extends BaseRecord {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
}

/** Factor data record */
export interface FactorDataRecord extends BaseRecord {
  symbol: string;
  timestamp: number;
  category: string;
  name: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/** Backtest result record */
export interface BacktestResultRecord extends BaseRecord {
  strategyId: string;
  strategyName: string;
  startDate: number;
  endDate: number;
  initialCapital: number;
  finalValue: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  winRate: number;
  config: Record<string, unknown>;
  metrics: Record<string, number>;
}

/** Portfolio record */
export interface PortfolioRecord extends BaseRecord {
  name: string;
  cash: number;
  totalValue: number;
  positions: PositionRecord[];
  metadata?: Record<string, unknown>;
}

/** Position record */
export interface PositionRecord {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  unrealizedPnl: number;
  openedAt: number;
}

/** Trade record */
export interface TradeRecord extends BaseRecord {
  portfolioId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  slippage: number;
  pnl?: number;
  pnlPercent?: number;
  holdingPeriodDays?: number;
  signalId?: string;
}

/** Signal record */
export interface SignalRecord extends BaseRecord {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  strength: number;
  confidence: number;
  strategyId: string;
  strategyName: string;
  factors: Array<{ name: string; value: number; weight: number }>;
  expiresAt: number;
}

/** Database configuration */
export interface DatabaseConfig {
  /** Path to SQLite database file */
  path: string;
  /** Enable WAL mode for better concurrency */
  walMode?: boolean;
  /** Busy timeout in ms */
  busyTimeout?: number;
  /** Enable foreign keys */
  foreignKeys?: boolean;
  /** Run migrations on startup */
  autoMigrate?: boolean;
}

/** Cache configuration */
export interface CacheConfig {
  /** Redis connection URL */
  url?: string;
  /** Redis host */
  host?: string;
  /** Redis port */
  port?: number;
  /** Redis password */
  password?: string;
  /** Database number */
  db?: number;
  /** Default TTL in seconds */
  defaultTtl?: number;
  /** Key prefix */
  prefix?: string;
  /** Enable fallback to memory cache when Redis unavailable */
  memoryFallback?: boolean;
}

/** Cache entry with metadata */
export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

/** Query options */
export interface QueryOptions {
  /** Order by field */
  orderBy?: string;
  /** Order direction */
  order?: 'asc' | 'desc';
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/** Query filter */
export interface QueryFilter {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'like' | 'in';
  value: unknown;
}

/** Batch operation result */
export interface BatchResult {
  success: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

/** Migration */
export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

/** Database statistics */
export interface DatabaseStats {
  tables: Map<string, number>;
  totalRecords: number;
  sizeBytes: number;
  lastOptimized?: number;
}

/** Cache statistics */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
  memoryUsed?: number;
  connected: boolean;
}

/** Storage manager interface */
export interface StorageManager {
  /** Initialize storage */
  initialize(): Promise<void>;
  /** Close connections */
  close(): Promise<void>;
  /** Get health status */
  isHealthy(): Promise<boolean>;
}
