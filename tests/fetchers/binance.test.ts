/**
 * Binance Fetcher Tests
 */

import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test';
import { BinanceFetcher } from '../../src/fetchers/binance';
import { MemoryCache } from '../../src/fetchers/cache';

describe('BinanceFetcher', () => {
  let fetcher: BinanceFetcher;
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache({ defaultTTL: 60000 });
    fetcher = new BinanceFetcher({ cache });
  });

  test('should have correct name and supported types', () => {
    expect(fetcher.name).toBe('binance');
    expect(fetcher.supportedTypes).toContain('crypto');
  });

  describe('getHistoricalData', () => {
    test('should fetch and parse OHLCV data', async () => {
      const mockData = [
        [1704067200000, '42000.00', '42500.00', '41800.00', '42300.00', '1000.5'],
        [1704153600000, '42300.00', '43000.00', '42100.00', '42800.00', '1200.3'],
      ];

      const mockFetch = spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await fetcher.getHistoricalData('BTCUSDT', '1d');

      expect(result.source).toBe('binance');
      expect(result.cached).toBe(false);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        timestamp: 1704067200000,
        open: 42000,
        high: 42500,
        low: 41800,
        close: 42300,
        volume: 1000.5,
      });

      mockFetch.mockRestore();
    });

    test('should cache results', async () => {
      const mockData = [[1704067200000, '42000', '42500', '41800', '42300', '1000']];

      const mockFetch = spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      // First call - fetches from API
      const result1 = await fetcher.getHistoricalData('BTCUSDT', '1d');
      expect(result1.cached).toBe(false);

      // Second call - from cache
      const result2 = await fetcher.getHistoricalData('BTCUSDT', '1d');
      expect(result2.cached).toBe(true);

      // Fetch should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);

      mockFetch.mockRestore();
    });
  });

  describe('getCurrentPrice', () => {
    test('should fetch and parse quote data', async () => {
      const tickerResponse = { symbol: 'BTCUSDT', price: '42500.00' };
      const bookResponse = {
        bidPrice: '42490.00',
        bidQty: '1.5',
        askPrice: '42510.00',
        askQty: '2.0',
      };

      let callCount = 0;
      const mockFetch = spyOn(global, 'fetch').mockImplementation(() => {
        callCount++;
        const data = callCount === 1 ? tickerResponse : bookResponse;
        return Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
      });

      const result = await fetcher.getCurrentPrice('BTCUSDT');

      expect(result.data.symbol).toBe('BTCUSDT');
      expect(result.data.price).toBe(42500);
      expect(result.data.bid).toBe(42490);
      expect(result.data.ask).toBe(42510);

      mockFetch.mockRestore();
    });
  });

  describe('getAssetInfo', () => {
    test('should fetch and parse exchange info', async () => {
      const mockData = {
        symbols: [
          {
            symbol: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            status: 'TRADING',
          },
        ],
      };

      const mockFetch = spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await fetcher.getAssetInfo('BTCUSDT');

      expect(result.data.symbol).toBe('BTCUSDT');
      expect(result.data.name).toBe('BTC/USDT');
      expect(result.data.exchange).toBe('binance');
      expect(result.data.type).toBe('crypto');
      expect(result.data.currency).toBe('USDT');

      mockFetch.mockRestore();
    });
  });

  describe('getOrderBook', () => {
    test('should fetch and parse order book', async () => {
      const mockData = {
        lastUpdateId: 12345,
        bids: [
          ['42490.00', '1.5'],
          ['42480.00', '2.0'],
        ],
        asks: [
          ['42510.00', '1.0'],
          ['42520.00', '3.0'],
        ],
      };

      const mockFetch = spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await fetcher.getOrderBook!('BTCUSDT', 10);

      expect(result.data.symbol).toBe('BTCUSDT');
      expect(result.data.bids).toHaveLength(2);
      expect(result.data.asks).toHaveLength(2);
      expect(result.data.bids[0]).toEqual({ price: 42490, quantity: 1.5 });

      mockFetch.mockRestore();
    });
  });

  describe('healthCheck', () => {
    test('should return true when API is healthy', async () => {
      // healthCheck calls getCurrentPrice which makes 2 fetch calls
      const tickerResponse = { symbol: 'BTCUSDT', price: '42000.00' };
      const bookResponse = { bidPrice: '41990.00', askPrice: '42010.00' };

      let callCount = 0;
      const mockFetch = spyOn(global, 'fetch').mockImplementation(() => {
        callCount++;
        const data = callCount === 1 ? tickerResponse : bookResponse;
        return Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
      });

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
