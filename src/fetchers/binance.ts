/**
 * Binance Data Fetcher
 * Crypto market data via Binance public API
 */

import { BaseFetcher, type BaseFetcherOptions } from './base';
import type {
  OHLCV,
  Quote,
  AssetInfo,
  Interval,
  PriceCallback,
  Subscription,
  OrderBook,
  FetchResult,
} from './types';
import { cacheKey } from './cache';

const BINANCE_API = 'https://api.binance.com/api/v3';
const BINANCE_WS = 'wss://stream.binance.com:9443/ws';

/** Binance interval mapping */
const INTERVAL_MAP: Record<Interval, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
  '1M': '1M',
};

export interface BinanceFetcherOptions extends BaseFetcherOptions {
  baseUrl?: string;
  wsUrl?: string;
}

export class BinanceFetcher extends BaseFetcher {
  readonly name = 'binance';
  readonly supportedTypes: AssetInfo['type'][] = ['crypto'];

  private baseUrl: string;
  private wsUrl: string;
  private subscriptions: Map<string, WebSocket> = new Map();

  constructor(options: BinanceFetcherOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? BINANCE_API;
    this.wsUrl = options.wsUrl ?? BINANCE_WS;
  }

  protected async fetchHistoricalData(
    symbol: string,
    interval: Interval,
    options?: { startTime?: number; endTime?: number; limit?: number }
  ): Promise<OHLCV[]> {
    const params = new URLSearchParams({
      symbol: this.normalizeSymbol(symbol),
      interval: INTERVAL_MAP[interval],
      limit: String(options?.limit ?? 500),
    });

    if (options?.startTime) params.set('startTime', String(options.startTime));
    if (options?.endTime) params.set('endTime', String(options.endTime));

    const response = await fetch(`${this.baseUrl}/klines?${params}`);

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as (string | number)[][];

    return data.map((candle) => ({
      timestamp: candle[0] as number,
      open: parseFloat(candle[1] as string),
      high: parseFloat(candle[2] as string),
      low: parseFloat(candle[3] as string),
      close: parseFloat(candle[4] as string),
      volume: parseFloat(candle[5] as string),
    }));
  }

  protected async fetchCurrentPrice(symbol: string): Promise<Quote> {
    const normalizedSymbol = this.normalizeSymbol(symbol);

    // Fetch ticker and book ticker in parallel
    const [tickerRes, bookRes] = await Promise.all([
      fetch(`${this.baseUrl}/ticker/price?symbol=${normalizedSymbol}`),
      fetch(`${this.baseUrl}/ticker/bookTicker?symbol=${normalizedSymbol}`),
    ]);

    if (!tickerRes.ok || !bookRes.ok) {
      throw new Error(`Binance API error fetching quote for ${symbol}`);
    }

    const ticker = (await tickerRes.json()) as { symbol: string; price: string };
    const book = (await bookRes.json()) as {
      bidPrice: string;
      bidQty: string;
      askPrice: string;
      askQty: string;
    };

    return {
      symbol: normalizedSymbol,
      price: parseFloat(ticker.price),
      bid: parseFloat(book.bidPrice),
      ask: parseFloat(book.askPrice),
      volume: 0, // Need 24hr ticker for volume
      timestamp: Date.now(),
    };
  }

  protected async fetchAssetInfo(symbol: string): Promise<AssetInfo> {
    const normalizedSymbol = this.normalizeSymbol(symbol);

    const response = await fetch(`${this.baseUrl}/exchangeInfo?symbol=${normalizedSymbol}`);

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      symbols: Array<{
        symbol: string;
        baseAsset: string;
        quoteAsset: string;
        status: string;
      }>;
    };

    const info = data.symbols[0];
    if (!info) {
      throw new Error(`Symbol ${symbol} not found on Binance`);
    }

    return {
      symbol: info.symbol,
      name: `${info.baseAsset}/${info.quoteAsset}`,
      exchange: 'binance',
      type: 'crypto',
      currency: info.quoteAsset,
      metadata: {
        baseAsset: info.baseAsset,
        quoteAsset: info.quoteAsset,
        status: info.status,
      },
    };
  }

  /** Subscribe to real-time price updates via WebSocket */
  subscribe(symbol: string, callback: PriceCallback): Subscription {
    const normalizedSymbol = this.normalizeSymbol(symbol).toLowerCase();
    const streamName = `${normalizedSymbol}@ticker`;

    // Check if already subscribed
    if (this.subscriptions.has(streamName)) {
      throw new Error(`Already subscribed to ${symbol}`);
    }

    const ws = new WebSocket(`${this.wsUrl}/${streamName}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          s: string; // symbol
          c: string; // close price
          b: string; // bid
          a: string; // ask
          v: string; // volume
          E: number; // event time
        };

        callback({
          symbol: data.s,
          price: parseFloat(data.c),
          bid: parseFloat(data.b),
          ask: parseFloat(data.a),
          volume: parseFloat(data.v),
          timestamp: data.E,
        });
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = () => {
      this.subscriptions.delete(streamName);
    };

    ws.onclose = () => {
      this.subscriptions.delete(streamName);
    };

    this.subscriptions.set(streamName, ws);

    return {
      symbol,
      unsubscribe: () => {
        ws.close();
        this.subscriptions.delete(streamName);
      },
    };
  }

  /** Get order book depth */
  async getOrderBook(symbol: string, limit = 20): Promise<FetchResult<OrderBook>> {
    const key = cacheKey(this.name, 'orderbook', symbol, limit);

    const cached = this.cache.get<OrderBook>(key);
    if (cached) {
      return this.wrapResult(cached, true, 0);
    }

    const start = Date.now();
    const normalizedSymbol = this.normalizeSymbol(symbol);

    const response = await fetch(
      `${this.baseUrl}/depth?symbol=${normalizedSymbol}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      lastUpdateId: number;
      bids: [string, string][];
      asks: [string, string][];
    };

    const orderBook: OrderBook = {
      symbol: normalizedSymbol,
      timestamp: Date.now(),
      bids: data.bids.map(([price, qty]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
      asks: data.asks.map(([price, qty]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
    };

    const latency = Date.now() - start;
    this.cache.set(key, orderBook, this.cacheTTL.orderBook);

    return this.wrapResult(orderBook, false, latency);
  }

  protected getHealthCheckSymbol(): string {
    return 'BTCUSDT';
  }

  /** Close all WebSocket connections */
  closeAll(): void {
    for (const ws of this.subscriptions.values()) {
      ws.close();
    }
    this.subscriptions.clear();
  }
}
