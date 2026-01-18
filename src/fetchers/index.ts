/**
 * Data Fetchers Module
 * Market data ingestion for MaxTrade
 */

// Types
export type {
  OHLCV,
  OrderBook,
  OrderBookEntry,
  Quote,
  AssetInfo,
  Interval,
  FetchResult,
  PriceCallback,
  Subscription,
  Fetcher,
  FetcherRegistry,
} from './types';

// Cache
export { MemoryCache, cacheKey, globalCache } from './cache';
export type { CacheOptions } from './cache';

// Base
export { BaseFetcher } from './base';
export type { BaseFetcherOptions } from './base';

// Implementations
export { BinanceFetcher } from './binance';
export type { BinanceFetcherOptions } from './binance';

export { YahooFetcher } from './yahoo';
export type { YahooFetcherOptions } from './yahoo';

// Registry
export { fetcherRegistry, initializeDefaultFetchers } from './registry';
