/**
 * Yahoo Finance Data Fetcher
 * Stock market data via Yahoo Finance API
 */

import { BaseFetcher, type BaseFetcherOptions } from './base';
import type { OHLCV, Quote, AssetInfo, Interval } from './types';

const YAHOO_API = 'https://query1.finance.yahoo.com/v8/finance';

/** Yahoo interval mapping */
const INTERVAL_MAP: Record<Interval, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '1h', // Yahoo doesn't have 4h, use 1h
  '1d': '1d',
  '1w': '1wk',
  '1M': '1mo',
};

/** Yahoo range based on interval */
const RANGE_MAP: Record<Interval, string> = {
  '1m': '7d',
  '5m': '60d',
  '15m': '60d',
  '1h': '730d',
  '4h': '730d',
  '1d': '10y',
  '1w': '10y',
  '1M': '10y',
};

export interface YahooFetcherOptions extends BaseFetcherOptions {
  baseUrl?: string;
}

export class YahooFetcher extends BaseFetcher {
  readonly name = 'yahoo';
  readonly supportedTypes: AssetInfo['type'][] = ['stock', 'etf'];

  private baseUrl: string;

  constructor(options: YahooFetcherOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl ?? YAHOO_API;
  }

  protected async fetchHistoricalData(
    symbol: string,
    interval: Interval,
    options?: { startTime?: number; endTime?: number; limit?: number }
  ): Promise<OHLCV[]> {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const yahooInterval = INTERVAL_MAP[interval];

    let url: string;

    if (options?.startTime && options?.endTime) {
      // Use period1/period2 for specific time range
      const period1 = Math.floor(options.startTime / 1000);
      const period2 = Math.floor(options.endTime / 1000);
      url = `${this.baseUrl}/chart/${normalizedSymbol}?interval=${yahooInterval}&period1=${period1}&period2=${period2}`;
    } else {
      // Use range for default
      const range = RANGE_MAP[interval];
      url = `${this.baseUrl}/chart/${normalizedSymbol}?interval=${yahooInterval}&range=${range}`;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MaxTrade/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      chart: {
        result: Array<{
          timestamp: number[];
          indicators: {
            quote: Array<{
              open: (number | null)[];
              high: (number | null)[];
              low: (number | null)[];
              close: (number | null)[];
              volume: (number | null)[];
            }>;
          };
        }>;
        error: { code: string; description: string } | null;
      };
    };

    if (data.chart.error) {
      throw new Error(`Yahoo API error: ${data.chart.error.description}`);
    }

    const result = data.chart.result[0];
    if (!result || !result.timestamp) {
      return [];
    }

    const quotes = result.indicators.quote[0];
    const candles: OHLCV[] = [];

    for (let i = 0; i < result.timestamp.length; i++) {
      // Skip if any value is null (market closed, etc.)
      if (
        quotes.open[i] === null ||
        quotes.high[i] === null ||
        quotes.low[i] === null ||
        quotes.close[i] === null
      ) {
        continue;
      }

      candles.push({
        timestamp: result.timestamp[i] * 1000, // Convert to milliseconds
        open: quotes.open[i]!,
        high: quotes.high[i]!,
        low: quotes.low[i]!,
        close: quotes.close[i]!,
        volume: quotes.volume[i] ?? 0,
      });
    }

    // Apply limit if specified
    if (options?.limit && candles.length > options.limit) {
      return candles.slice(-options.limit);
    }

    return candles;
  }

  protected async fetchCurrentPrice(symbol: string): Promise<Quote> {
    const normalizedSymbol = this.normalizeSymbol(symbol);

    const response = await fetch(
      `${this.baseUrl}/chart/${normalizedSymbol}?interval=1m&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MaxTrade/1.0)',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      chart: {
        result: Array<{
          meta: {
            regularMarketPrice: number;
            bid?: number;
            ask?: number;
            regularMarketVolume: number;
          };
        }>;
        error: { description: string } | null;
      };
    };

    if (data.chart.error) {
      throw new Error(`Yahoo API error: ${data.chart.error.description}`);
    }

    const meta = data.chart.result[0]?.meta;
    if (!meta) {
      throw new Error(`No data found for ${symbol}`);
    }

    return {
      symbol: normalizedSymbol,
      price: meta.regularMarketPrice,
      bid: meta.bid ?? meta.regularMarketPrice,
      ask: meta.ask ?? meta.regularMarketPrice,
      volume: meta.regularMarketVolume,
      timestamp: Date.now(),
    };
  }

  protected async fetchAssetInfo(symbol: string): Promise<AssetInfo> {
    const normalizedSymbol = this.normalizeSymbol(symbol);

    // Use quoteSummary for detailed info
    const response = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${normalizedSymbol}?modules=price,summaryProfile`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MaxTrade/1.0)',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      quoteSummary: {
        result: Array<{
          price: {
            shortName: string;
            longName: string;
            exchange: string;
            quoteType: string;
            currency: string;
            marketCap?: { raw: number };
          };
          summaryProfile?: {
            sector?: string;
            industry?: string;
            country?: string;
          };
        }>;
        error: { description: string } | null;
      };
    };

    if (data.quoteSummary.error) {
      throw new Error(`Yahoo API error: ${data.quoteSummary.error.description}`);
    }

    const result = data.quoteSummary.result[0];
    if (!result) {
      throw new Error(`No data found for ${symbol}`);
    }

    const price = result.price;
    const profile = result.summaryProfile;

    // Determine asset type
    let type: AssetInfo['type'] = 'stock';
    if (price.quoteType === 'ETF') type = 'etf';
    if (price.quoteType === 'CRYPTOCURRENCY') type = 'crypto';

    return {
      symbol: normalizedSymbol,
      name: price.longName || price.shortName || normalizedSymbol,
      exchange: price.exchange,
      type,
      currency: price.currency,
      metadata: {
        quoteType: price.quoteType,
        marketCap: price.marketCap?.raw,
        sector: profile?.sector,
        industry: profile?.industry,
        country: profile?.country,
      },
    };
  }

  protected getHealthCheckSymbol(): string {
    return 'AAPL';
  }

  protected normalizeSymbol(symbol: string): string {
    // Yahoo uses uppercase symbols, dots for class shares
    return symbol.toUpperCase();
  }
}
