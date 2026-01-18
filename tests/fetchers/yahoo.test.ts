/**
 * Yahoo Fetcher Tests
 */

import { describe, test, expect, beforeEach, spyOn } from 'bun:test';
import { YahooFetcher } from '../../src/fetchers/yahoo';
import { MemoryCache } from '../../src/fetchers/cache';

describe('YahooFetcher', () => {
  let fetcher: YahooFetcher;
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache({ defaultTTL: 60000 });
    fetcher = new YahooFetcher({ cache });
  });

  test('should have correct name and supported types', () => {
    expect(fetcher.name).toBe('yahoo');
    expect(fetcher.supportedTypes).toContain('stock');
    expect(fetcher.supportedTypes).toContain('etf');
  });

  describe('getHistoricalData', () => {
    test('should fetch and parse OHLCV data', async () => {
      const mockData = {
        chart: {
          result: [
            {
              timestamp: [1704067200, 1704153600],
              indicators: {
                quote: [
                  {
                    open: [185.5, 186.0],
                    high: [187.0, 188.5],
                    low: [184.0, 185.5],
                    close: [186.5, 188.0],
                    volume: [50000000, 45000000],
                  },
                ],
              },
            },
          ],
          error: null,
        },
      };

      const mockFetch = spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await fetcher.getHistoricalData('AAPL', '1d');

      expect(result.source).toBe('yahoo');
      expect(result.cached).toBe(false);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        timestamp: 1704067200000, // Converted to ms
        open: 185.5,
        high: 187.0,
        low: 184.0,
        close: 186.5,
        volume: 50000000,
      });

      mockFetch.mockRestore();
    });

    test('should skip null values', async () => {
      const mockData = {
        chart: {
          result: [
            {
              timestamp: [1704067200, 1704153600, 1704240000],
              indicators: {
                quote: [
                  {
                    open: [185.5, null, 187.0],
                    high: [187.0, null, 189.0],
                    low: [184.0, null, 186.0],
                    close: [186.5, null, 188.5],
                    volume: [50000000, null, 48000000],
                  },
                ],
              },
            },
          ],
          error: null,
        },
      };

      const mockFetch = spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await fetcher.getHistoricalData('AAPL', '1d');

      // Should only have 2 valid candles, skipping the null one
      expect(result.data).toHaveLength(2);

      mockFetch.mockRestore();
    });

    test('should apply limit option', async () => {
      const mockData = {
        chart: {
          result: [
            {
              timestamp: [1, 2, 3, 4, 5],
              indicators: {
                quote: [
                  {
                    open: [1, 2, 3, 4, 5],
                    high: [1, 2, 3, 4, 5],
                    low: [1, 2, 3, 4, 5],
                    close: [1, 2, 3, 4, 5],
                    volume: [1, 2, 3, 4, 5],
                  },
                ],
              },
            },
          ],
          error: null,
        },
      };

      const mockFetch = spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await fetcher.getHistoricalData('AAPL', '1d', { limit: 2 });

      expect(result.data).toHaveLength(2);
      // Should return the last 2 candles
      expect(result.data[0].timestamp).toBe(4000);
      expect(result.data[1].timestamp).toBe(5000);

      mockFetch.mockRestore();
    });
  });

  describe('getCurrentPrice', () => {
    test('should fetch and parse quote data', async () => {
      const mockData = {
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 188.5,
                bid: 188.4,
                ask: 188.6,
                regularMarketVolume: 45000000,
              },
            },
          ],
          error: null,
        },
      };

      const mockFetch = spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await fetcher.getCurrentPrice('AAPL');

      expect(result.data.symbol).toBe('AAPL');
      expect(result.data.price).toBe(188.5);
      expect(result.data.bid).toBe(188.4);
      expect(result.data.ask).toBe(188.6);
      expect(result.data.volume).toBe(45000000);

      mockFetch.mockRestore();
    });

    test('should use price as bid/ask fallback', async () => {
      const mockData = {
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 188.5,
                regularMarketVolume: 45000000,
                // No bid/ask
              },
            },
          ],
          error: null,
        },
      };

      const mockFetch = spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await fetcher.getCurrentPrice('AAPL');

      expect(result.data.bid).toBe(188.5);
      expect(result.data.ask).toBe(188.5);

      mockFetch.mockRestore();
    });
  });

  describe('getAssetInfo', () => {
    test('should fetch and parse asset info', async () => {
      const mockData = {
        quoteSummary: {
          result: [
            {
              price: {
                shortName: 'Apple Inc.',
                longName: 'Apple Inc.',
                exchange: 'NASDAQ',
                quoteType: 'EQUITY',
                currency: 'USD',
                marketCap: { raw: 2900000000000 },
              },
              summaryProfile: {
                sector: 'Technology',
                industry: 'Consumer Electronics',
                country: 'United States',
              },
            },
          ],
          error: null,
        },
      };

      const mockFetch = spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await fetcher.getAssetInfo('AAPL');

      expect(result.data.symbol).toBe('AAPL');
      expect(result.data.name).toBe('Apple Inc.');
      expect(result.data.exchange).toBe('NASDAQ');
      expect(result.data.type).toBe('stock');
      expect(result.data.currency).toBe('USD');
      expect(result.data.metadata?.sector).toBe('Technology');

      mockFetch.mockRestore();
    });

    test('should detect ETF type', async () => {
      const mockData = {
        quoteSummary: {
          result: [
            {
              price: {
                shortName: 'SPDR S&P 500',
                longName: 'SPDR S&P 500 ETF Trust',
                exchange: 'NYSE ARCA',
                quoteType: 'ETF',
                currency: 'USD',
              },
            },
          ],
          error: null,
        },
      };

      const mockFetch = spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await fetcher.getAssetInfo('SPY');

      expect(result.data.type).toBe('etf');

      mockFetch.mockRestore();
    });
  });

  describe('healthCheck', () => {
    test('should return true when API is healthy', async () => {
      const mockData = {
        chart: {
          result: [{ meta: { regularMarketPrice: 188.5, regularMarketVolume: 1000 } }],
          error: null,
        },
      };

      const mockFetch = spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const healthy = await fetcher.healthCheck();
      expect(healthy).toBe(true);

      mockFetch.mockRestore();
    });

    test('should return false when API fails', async () => {
      const mockFetch = spyOn(global, 'fetch').mockRejectedValue(
        new Error('Network error')
      );

      const healthy = await fetcher.healthCheck();
      expect(healthy).toBe(false);

      mockFetch.mockRestore();
    });
  });
});
