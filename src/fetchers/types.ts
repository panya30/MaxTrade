/**
 * Data Fetcher Types
 * Based on QuantMuse patterns - dataclass style for immutable data
 */

/** OHLCV candle data */
export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Order book entry */
export interface OrderBookEntry {
  price: number;
  quantity: number;
}

/** Order book depth */
export interface OrderBook {
  symbol: string;
  timestamp: number;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

/** Real-time quote */
export interface Quote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
}

/** Company/Asset info */
export interface AssetInfo {
  symbol: string;
  name: string;
  exchange: string;
  type: 'stock' | 'crypto' | 'etf' | 'forex';
  currency: string;
  metadata?: Record<string, unknown>;
}

/** Time intervals for historical data */
export type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';

/** Fetcher result wrapper */
export interface FetchResult<T> {
  data: T;
  source: string;
  cached: boolean;
  timestamp: number;
  latencyMs: number;
}

/** Price callback for subscriptions */
export type PriceCallback = (quote: Quote) => void;

/** Subscription handle */
export interface Subscription {
  symbol: string;
  unsubscribe: () => void;
}

/**
 * Base Fetcher Interface
 * ABC-style pattern from QuantMuse
 */
export interface Fetcher {
  readonly name: string;
  readonly supportedTypes: AssetInfo['type'][];

  /** Get historical OHLCV data */
  getHistoricalData(
    symbol: string,
    interval: Interval,
    options?: {
      startTime?: number;
      endTime?: number;
      limit?: number;
    }
  ): Promise<FetchResult<OHLCV[]>>;

  /** Get current price/quote */
  getCurrentPrice(symbol: string): Promise<FetchResult<Quote>>;

  /** Get asset information */
  getAssetInfo(symbol: string): Promise<FetchResult<AssetInfo>>;

  /** Subscribe to real-time updates (optional) */
  subscribe?(symbol: string, callback: PriceCallback): Subscription;

  /** Get order book depth (optional) */
  getOrderBook?(symbol: string, limit?: number): Promise<FetchResult<OrderBook>>;

  /** Check if fetcher is healthy */
  healthCheck(): Promise<boolean>;
}

/**
 * Fetcher Registry for managing multiple data sources
 * Service Locator pattern from QuantMuse
 */
export interface FetcherRegistry {
  register(fetcher: Fetcher): void;
  get(name: string): Fetcher | undefined;
  getForType(type: AssetInfo['type']): Fetcher[];
  list(): string[];
}
