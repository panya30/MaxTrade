/**
 * Storage Module
 * SQLite database and Redis cache layer
 */

// Types
export type {
  BaseRecord,
  MarketDataRecord,
  FactorDataRecord,
  BacktestResultRecord,
  PortfolioRecord,
  PositionRecord,
  TradeRecord,
  SignalRecord,
  DatabaseConfig,
  CacheConfig,
  CacheEntry,
  QueryOptions,
  QueryFilter,
  BatchResult,
  Migration,
  DatabaseStats,
  CacheStats,
  StorageManager,
} from './types';

// Database
export {
  DatabaseManager,
  createDatabaseManager,
  DEFAULT_DB_CONFIG,
} from './database';

// Cache
export {
  CacheManager,
  MemoryCache,
  createCacheManager,
  DEFAULT_CACHE_CONFIG,
} from './cache';

// Repositories
export {
  MarketDataRepository,
  FactorDataRepository,
  BacktestResultsRepository,
  PortfolioRepository,
  TradeRepository,
  SignalRepository,
  type Repository,
} from './repositories';

/**
 * Create storage instance with both database and cache
 */
export interface StorageInstance {
  db: import('./database').DatabaseManager;
  cache: import('./cache').CacheManager;
  marketData: import('./repositories').MarketDataRepository;
  factorData: import('./repositories').FactorDataRepository;
  backtestResults: import('./repositories').BacktestResultsRepository;
  portfolios: import('./repositories').PortfolioRepository;
  trades: import('./repositories').TradeRepository;
  signals: import('./repositories').SignalRepository;
  initialize(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Create a fully configured storage instance
 */
export async function createStorage(config?: {
  database?: Partial<import('./types').DatabaseConfig>;
  cache?: Partial<import('./types').CacheConfig>;
}): Promise<StorageInstance> {
  const { DatabaseManager } = await import('./database');
  const { CacheManager } = await import('./cache');
  const {
    MarketDataRepository,
    FactorDataRepository,
    BacktestResultsRepository,
    PortfolioRepository,
    TradeRepository,
    SignalRepository,
  } = await import('./repositories');

  const db = new DatabaseManager(config?.database);
  const cache = new CacheManager(config?.cache);

  const instance: StorageInstance = {
    db,
    cache,
    marketData: new MarketDataRepository(db, cache),
    factorData: new FactorDataRepository(db, cache),
    backtestResults: new BacktestResultsRepository(db, cache),
    portfolios: new PortfolioRepository(db, cache),
    trades: new TradeRepository(db, cache),
    signals: new SignalRepository(db, cache),

    async initialize() {
      await db.initialize();
      await cache.initialize();
    },

    async close() {
      await cache.close();
      await db.close();
    },
  };

  return instance;
}
