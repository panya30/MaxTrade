/**
 * Base Fetcher Implementation
 * Template Method pattern from QuantMuse - hooks for subclass customization
 */

import type {
  Fetcher,
  FetchResult,
  OHLCV,
  Quote,
  AssetInfo,
  Interval,
  PriceCallback,
  Subscription,
  OrderBook,
} from './types';
import { MemoryCache, cacheKey, globalCache } from './cache';

export interface BaseFetcherOptions {
  cache?: MemoryCache;
  cacheTTL?: {
    quote: number;
    historical: number;
    assetInfo: number;
    orderBook: number;
  };
}

const DEFAULT_TTL = {
  quote: 5_000, // 5 seconds for real-time quotes
  historical: 300_000, // 5 minutes for historical data
  assetInfo: 3600_000, // 1 hour for asset info
  orderBook: 1_000, // 1 second for order book
};

/**
 * Abstract Base Fetcher
 * Provides caching, error handling, and common utilities
 */
export abstract class BaseFetcher implements Fetcher {
  abstract readonly name: string;
  abstract readonly supportedTypes: AssetInfo['type'][];

  protected cache: MemoryCache;
  protected cacheTTL: typeof DEFAULT_TTL;

  constructor(options: BaseFetcherOptions = {}) {
    this.cache = options.cache ?? globalCache;
    this.cacheTTL = { ...DEFAULT_TTL, ...options.cacheTTL };
  }

  /** Must be implemented by subclasses */
  protected abstract fetchHistoricalData(
    symbol: string,
    interval: Interval,
    options?: { startTime?: number; endTime?: number; limit?: number }
  ): Promise<OHLCV[]>;

  protected abstract fetchCurrentPrice(symbol: string): Promise<Quote>;

  protected abstract fetchAssetInfo(symbol: string): Promise<AssetInfo>;

  /** Get historical data with caching */
  async getHistoricalData(
    symbol: string,
    interval: Interval,
    options?: { startTime?: number; endTime?: number; limit?: number }
  ): Promise<FetchResult<OHLCV[]>> {
    const key = cacheKey(
      this.name,
      'historical',
      symbol,
      interval,
      options?.startTime,
      options?.endTime,
      options?.limit
    );

    const cached = this.cache.get<OHLCV[]>(key);
    if (cached) {
      return this.wrapResult(cached, true, 0);
    }

    const start = Date.now();
    const data = await this.fetchHistoricalData(symbol, interval, options);
    const latency = Date.now() - start;

    this.cache.set(key, data, this.cacheTTL.historical);
    return this.wrapResult(data, false, latency);
  }

  /** Get current price with caching */
  async getCurrentPrice(symbol: string): Promise<FetchResult<Quote>> {
    const key = cacheKey(this.name, 'quote', symbol);

    const cached = this.cache.get<Quote>(key);
    if (cached) {
      return this.wrapResult(cached, true, 0);
    }

    const start = Date.now();
    const data = await this.fetchCurrentPrice(symbol);
    const latency = Date.now() - start;

    this.cache.set(key, data, this.cacheTTL.quote);
    return this.wrapResult(data, false, latency);
  }

  /** Get asset info with caching */
  async getAssetInfo(symbol: string): Promise<FetchResult<AssetInfo>> {
    const key = cacheKey(this.name, 'info', symbol);

    const cached = this.cache.get<AssetInfo>(key);
    if (cached) {
      return this.wrapResult(cached, true, 0);
    }

    const start = Date.now();
    const data = await this.fetchAssetInfo(symbol);
    const latency = Date.now() - start;

    this.cache.set(key, data, this.cacheTTL.assetInfo);
    return this.wrapResult(data, false, latency);
  }

  /** Optional: Subscribe to real-time updates */
  subscribe?(symbol: string, callback: PriceCallback): Subscription;

  /** Optional: Get order book */
  getOrderBook?(symbol: string, limit?: number): Promise<FetchResult<OrderBook>>;

  /** Health check - default implementation */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to fetch a common asset
      await this.getCurrentPrice(this.getHealthCheckSymbol());
      return true;
    } catch {
      return false;
    }
  }

  /** Symbol to use for health checks - override in subclass */
  protected getHealthCheckSymbol(): string {
    return 'BTCUSDT';
  }

  /** Wrap data in FetchResult */
  protected wrapResult<T>(data: T, cached: boolean, latencyMs: number): FetchResult<T> {
    return {
      data,
      source: this.name,
      cached,
      timestamp: Date.now(),
      latencyMs,
    };
  }

  /** Normalize symbol for this exchange */
  protected normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
}
