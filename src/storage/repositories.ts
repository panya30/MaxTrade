/**
 * Data Repositories
 * High-level data access layer
 */

import type {
  MarketDataRecord,
  FactorDataRecord,
  BacktestResultRecord,
  PortfolioRecord,
  TradeRecord,
  SignalRecord,
  QueryOptions,
  QueryFilter,
} from './types';
import type { DatabaseManager } from './database';
import type { CacheManager } from './cache';

/** Base repository interface */
export interface Repository<T> {
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<T | null>;
  find(filters?: QueryFilter[], options?: QueryOptions): Promise<T[]>;
  count(filters?: QueryFilter[]): Promise<number>;
}

/**
 * Market Data Repository
 */
export class MarketDataRepository implements Repository<MarketDataRecord> {
  constructor(
    private db: DatabaseManager,
    private cache: CacheManager
  ) {}

  async create(
    data: Omit<MarketDataRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MarketDataRecord> {
    const id = this.db.insert('market_data', data);
    const record = this.db.findById<MarketDataRecord>('market_data', id);
    if (!record) throw new Error('Failed to create market data record');

    // Invalidate cache for this symbol
    await this.cache.deletePattern(`market:${data.symbol}:*`);
    return record;
  }

  async update(
    id: string,
    data: Partial<MarketDataRecord>
  ): Promise<MarketDataRecord | null> {
    const success = this.db.update('market_data', id, data);
    if (!success) return null;

    const record = this.db.findById<MarketDataRecord>('market_data', id);
    if (record) {
      await this.cache.deletePattern(`market:${record.symbol}:*`);
    }
    return record;
  }

  async delete(id: string): Promise<boolean> {
    const record = this.db.findById<MarketDataRecord>('market_data', id);
    const success = this.db.delete('market_data', id);
    if (success && record) {
      await this.cache.deletePattern(`market:${record.symbol}:*`);
    }
    return success;
  }

  async findById(id: string): Promise<MarketDataRecord | null> {
    return this.db.findById('market_data', id);
  }

  async find(
    filters: QueryFilter[] = [],
    options: QueryOptions = {}
  ): Promise<MarketDataRecord[]> {
    return this.db.find('market_data', filters, options);
  }

  async count(filters: QueryFilter[] = []): Promise<number> {
    return this.db.count('market_data', filters);
  }

  /**
   * Get latest bar for symbol
   */
  async getLatest(symbol: string): Promise<MarketDataRecord | null> {
    const cacheKey = `market:${symbol}:latest`;
    const cached = await this.cache.get<MarketDataRecord>(cacheKey);
    if (cached) return cached;

    const results = this.db.find<MarketDataRecord>(
      'market_data',
      [{ field: 'symbol', operator: '=', value: symbol }],
      { orderBy: 'timestamp', order: 'desc', limit: 1 }
    );

    if (results.length > 0) {
      await this.cache.set(cacheKey, results[0], 60); // Cache for 1 minute
      return results[0];
    }

    return null;
  }

  /**
   * Get bars for symbol in date range
   */
  async getRange(
    symbol: string,
    startDate: number,
    endDate: number
  ): Promise<MarketDataRecord[]> {
    return this.db.find<MarketDataRecord>(
      'market_data',
      [
        { field: 'symbol', operator: '=', value: symbol },
        { field: 'timestamp', operator: '>=', value: startDate },
        { field: 'timestamp', operator: '<=', value: endDate },
      ],
      { orderBy: 'timestamp', order: 'asc' }
    );
  }

  /**
   * Bulk insert market data
   */
  async bulkCreate(
    data: Array<Omit<MarketDataRecord, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<number> {
    const result = this.db.batchInsert('market_data', data);
    return result.success;
  }
}

/**
 * Factor Data Repository
 */
export class FactorDataRepository implements Repository<FactorDataRecord> {
  constructor(
    private db: DatabaseManager,
    private cache: CacheManager
  ) {}

  async create(
    data: Omit<FactorDataRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FactorDataRecord> {
    const id = this.db.insert('factor_data', data);
    const record = this.db.findById<FactorDataRecord>('factor_data', id);
    if (!record) throw new Error('Failed to create factor data record');
    return record;
  }

  async update(
    id: string,
    data: Partial<FactorDataRecord>
  ): Promise<FactorDataRecord | null> {
    const success = this.db.update('factor_data', id, data);
    if (!success) return null;
    return this.db.findById('factor_data', id);
  }

  async delete(id: string): Promise<boolean> {
    return this.db.delete('factor_data', id);
  }

  async findById(id: string): Promise<FactorDataRecord | null> {
    return this.db.findById('factor_data', id);
  }

  async find(
    filters: QueryFilter[] = [],
    options: QueryOptions = {}
  ): Promise<FactorDataRecord[]> {
    return this.db.find('factor_data', filters, options);
  }

  async count(filters: QueryFilter[] = []): Promise<number> {
    return this.db.count('factor_data', filters);
  }

  /**
   * Get factors for symbol
   */
  async getForSymbol(
    symbol: string,
    category?: string
  ): Promise<FactorDataRecord[]> {
    const cacheKey = `factors:${symbol}:${category ?? 'all'}`;
    const cached = await this.cache.get<FactorDataRecord[]>(cacheKey);
    if (cached) return cached;

    const filters: QueryFilter[] = [
      { field: 'symbol', operator: '=', value: symbol },
    ];
    if (category) {
      filters.push({ field: 'category', operator: '=', value: category });
    }

    const results = this.db.find<FactorDataRecord>('factor_data', filters, {
      orderBy: 'timestamp',
      order: 'desc',
    });

    await this.cache.set(cacheKey, results, 300); // Cache for 5 minutes
    return results;
  }
}

/**
 * Backtest Results Repository
 */
export class BacktestResultsRepository
  implements Repository<BacktestResultRecord>
{
  constructor(
    private db: DatabaseManager,
    private cache: CacheManager
  ) {}

  async create(
    data: Omit<BacktestResultRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<BacktestResultRecord> {
    const id = this.db.insert('backtest_results', data);
    const record = this.db.findById<BacktestResultRecord>(
      'backtest_results',
      id
    );
    if (!record) throw new Error('Failed to create backtest result');
    return record;
  }

  async update(
    id: string,
    data: Partial<BacktestResultRecord>
  ): Promise<BacktestResultRecord | null> {
    const success = this.db.update('backtest_results', id, data);
    if (!success) return null;
    return this.db.findById('backtest_results', id);
  }

  async delete(id: string): Promise<boolean> {
    return this.db.delete('backtest_results', id);
  }

  async findById(id: string): Promise<BacktestResultRecord | null> {
    return this.db.findById('backtest_results', id);
  }

  async find(
    filters: QueryFilter[] = [],
    options: QueryOptions = {}
  ): Promise<BacktestResultRecord[]> {
    return this.db.find('backtest_results', filters, options);
  }

  async count(filters: QueryFilter[] = []): Promise<number> {
    return this.db.count('backtest_results', filters);
  }

  /**
   * Get results for strategy
   */
  async getForStrategy(strategyId: string): Promise<BacktestResultRecord[]> {
    return this.db.find<BacktestResultRecord>(
      'backtest_results',
      [{ field: 'strategyId', operator: '=', value: strategyId }],
      { orderBy: 'createdAt', order: 'desc' }
    );
  }

  /**
   * Get best result for strategy
   */
  async getBestForStrategy(
    strategyId: string
  ): Promise<BacktestResultRecord | null> {
    const results = this.db.find<BacktestResultRecord>(
      'backtest_results',
      [{ field: 'strategyId', operator: '=', value: strategyId }],
      { orderBy: 'sharpeRatio', order: 'desc', limit: 1 }
    );
    return results[0] ?? null;
  }
}

/**
 * Portfolio Repository
 */
export class PortfolioRepository implements Repository<PortfolioRecord> {
  constructor(
    private db: DatabaseManager,
    private cache: CacheManager
  ) {}

  async create(
    data: Omit<PortfolioRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<PortfolioRecord> {
    const id = this.db.insert('portfolios', data);
    const record = this.db.findById<PortfolioRecord>('portfolios', id);
    if (!record) throw new Error('Failed to create portfolio');
    return record;
  }

  async update(
    id: string,
    data: Partial<PortfolioRecord>
  ): Promise<PortfolioRecord | null> {
    const success = this.db.update('portfolios', id, data);
    if (!success) return null;

    // Invalidate cache
    await this.cache.delete(`portfolio:${id}`);
    return this.db.findById('portfolios', id);
  }

  async delete(id: string): Promise<boolean> {
    const success = this.db.delete('portfolios', id);
    if (success) {
      await this.cache.delete(`portfolio:${id}`);
    }
    return success;
  }

  async findById(id: string): Promise<PortfolioRecord | null> {
    const cacheKey = `portfolio:${id}`;
    const cached = await this.cache.get<PortfolioRecord>(cacheKey);
    if (cached) return cached;

    const record = this.db.findById<PortfolioRecord>('portfolios', id);
    if (record) {
      await this.cache.set(cacheKey, record, 60);
    }
    return record;
  }

  async find(
    filters: QueryFilter[] = [],
    options: QueryOptions = {}
  ): Promise<PortfolioRecord[]> {
    return this.db.find('portfolios', filters, options);
  }

  async count(filters: QueryFilter[] = []): Promise<number> {
    return this.db.count('portfolios', filters);
  }
}

/**
 * Trade Repository
 */
export class TradeRepository implements Repository<TradeRecord> {
  constructor(
    private db: DatabaseManager,
    private cache: CacheManager
  ) {}

  async create(
    data: Omit<TradeRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<TradeRecord> {
    const id = this.db.insert('trades', data);
    const record = this.db.findById<TradeRecord>('trades', id);
    if (!record) throw new Error('Failed to create trade');
    return record;
  }

  async update(
    id: string,
    data: Partial<TradeRecord>
  ): Promise<TradeRecord | null> {
    const success = this.db.update('trades', id, data);
    if (!success) return null;
    return this.db.findById('trades', id);
  }

  async delete(id: string): Promise<boolean> {
    return this.db.delete('trades', id);
  }

  async findById(id: string): Promise<TradeRecord | null> {
    return this.db.findById('trades', id);
  }

  async find(
    filters: QueryFilter[] = [],
    options: QueryOptions = {}
  ): Promise<TradeRecord[]> {
    return this.db.find('trades', filters, options);
  }

  async count(filters: QueryFilter[] = []): Promise<number> {
    return this.db.count('trades', filters);
  }

  /**
   * Get trades for portfolio
   */
  async getForPortfolio(
    portfolioId: string,
    options: QueryOptions = {}
  ): Promise<TradeRecord[]> {
    return this.db.find<TradeRecord>(
      'trades',
      [{ field: 'portfolioId', operator: '=', value: portfolioId }],
      { orderBy: 'createdAt', order: 'desc', ...options }
    );
  }

  /**
   * Get trades for symbol
   */
  async getForSymbol(
    symbol: string,
    options: QueryOptions = {}
  ): Promise<TradeRecord[]> {
    return this.db.find<TradeRecord>(
      'trades',
      [{ field: 'symbol', operator: '=', value: symbol }],
      { orderBy: 'createdAt', order: 'desc', ...options }
    );
  }
}

/**
 * Signal Repository
 */
export class SignalRepository implements Repository<SignalRecord> {
  constructor(
    private db: DatabaseManager,
    private cache: CacheManager
  ) {}

  async create(
    data: Omit<SignalRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SignalRecord> {
    const id = this.db.insert('signals', data);
    const record = this.db.findById<SignalRecord>('signals', id);
    if (!record) throw new Error('Failed to create signal');

    // Cache active signal
    if (record.expiresAt > Date.now()) {
      const ttl = Math.floor((record.expiresAt - Date.now()) / 1000);
      await this.cache.set(`signal:${record.symbol}:latest`, record, ttl);
    }

    return record;
  }

  async update(
    id: string,
    data: Partial<SignalRecord>
  ): Promise<SignalRecord | null> {
    const success = this.db.update('signals', id, data);
    if (!success) return null;
    return this.db.findById('signals', id);
  }

  async delete(id: string): Promise<boolean> {
    const record = this.db.findById<SignalRecord>('signals', id);
    const success = this.db.delete('signals', id);
    if (success && record) {
      await this.cache.delete(`signal:${record.symbol}:latest`);
    }
    return success;
  }

  async findById(id: string): Promise<SignalRecord | null> {
    return this.db.findById('signals', id);
  }

  async find(
    filters: QueryFilter[] = [],
    options: QueryOptions = {}
  ): Promise<SignalRecord[]> {
    return this.db.find('signals', filters, options);
  }

  async count(filters: QueryFilter[] = []): Promise<number> {
    return this.db.count('signals', filters);
  }

  /**
   * Get active signals
   */
  async getActive(): Promise<SignalRecord[]> {
    return this.db.find<SignalRecord>(
      'signals',
      [{ field: 'expiresAt', operator: '>', value: Date.now() }],
      { orderBy: 'strength', order: 'desc' }
    );
  }

  /**
   * Get latest signal for symbol
   */
  async getLatestForSymbol(symbol: string): Promise<SignalRecord | null> {
    const cacheKey = `signal:${symbol}:latest`;
    const cached = await this.cache.get<SignalRecord>(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const results = this.db.find<SignalRecord>(
      'signals',
      [
        { field: 'symbol', operator: '=', value: symbol },
        { field: 'expiresAt', operator: '>', value: Date.now() },
      ],
      { orderBy: 'createdAt', order: 'desc', limit: 1 }
    );

    if (results.length > 0) {
      const ttl = Math.floor((results[0].expiresAt - Date.now()) / 1000);
      await this.cache.set(cacheKey, results[0], Math.max(ttl, 1));
      return results[0];
    }

    return null;
  }

  /**
   * Clean up expired signals
   */
  async cleanupExpired(): Promise<number> {
    const expired = this.db.find<SignalRecord>('signals', [
      { field: 'expiresAt', operator: '<', value: Date.now() },
    ]);

    let deleted = 0;
    for (const signal of expired) {
      if (this.db.delete('signals', signal.id)) {
        deleted++;
      }
    }

    return deleted;
  }
}
