/**
 * Fetcher Registry Tests
 */

import { describe, test, expect, beforeEach, spyOn } from 'bun:test';
import { fetcherRegistry, initializeDefaultFetchers } from '../../src/fetchers/registry';
import { BinanceFetcher } from '../../src/fetchers/binance';
import { YahooFetcher } from '../../src/fetchers/yahoo';
import type { Fetcher, AssetInfo } from '../../src/fetchers/types';

describe('FetcherRegistry', () => {
  beforeEach(() => {
    // Clear registry before each test
    fetcherRegistry.clear();
  });

  test('should register and retrieve fetchers', () => {
    const binance = new BinanceFetcher();
    fetcherRegistry.register(binance);

    expect(fetcherRegistry.get('binance')).toBe(binance);
  });

  test('should list registered fetchers', () => {
    fetcherRegistry.register(new BinanceFetcher());
    fetcherRegistry.register(new YahooFetcher());

    const names = fetcherRegistry.list();
    expect(names).toContain('binance');
    expect(names).toContain('yahoo');
  });

  test('should return undefined for unknown fetcher', () => {
    expect(fetcherRegistry.get('unknown')).toBeUndefined();
  });

  test('should unregister fetchers', () => {
    fetcherRegistry.register(new BinanceFetcher());
    expect(fetcherRegistry.get('binance')).toBeDefined();

    fetcherRegistry.unregister('binance');
    expect(fetcherRegistry.get('binance')).toBeUndefined();
  });

  test('should get fetchers by type', () => {
    fetcherRegistry.register(new BinanceFetcher());
    fetcherRegistry.register(new YahooFetcher());

    const cryptoFetchers = fetcherRegistry.getForType('crypto');
    expect(cryptoFetchers).toHaveLength(1);
    expect(cryptoFetchers[0].name).toBe('binance');

    const stockFetchers = fetcherRegistry.getForType('stock');
    expect(stockFetchers).toHaveLength(1);
    expect(stockFetchers[0].name).toBe('yahoo');
  });

  test('should replace duplicate registrations', () => {
    const fetcher1 = new BinanceFetcher();
    const fetcher2 = new BinanceFetcher();

    fetcherRegistry.register(fetcher1);
    fetcherRegistry.register(fetcher2);

    expect(fetcherRegistry.list()).toHaveLength(1);
    expect(fetcherRegistry.get('binance')).toBe(fetcher2);
  });

  describe('healthCheckAll', () => {
    test('should check health of all fetchers', async () => {
      // Create mock fetchers with controllable health
      const healthyFetcher: Fetcher = {
        name: 'healthy',
        supportedTypes: ['crypto'],
        getHistoricalData: async () => ({ data: [], source: 'healthy', cached: false, timestamp: 0, latencyMs: 0 }),
        getCurrentPrice: async () => ({ data: {} as any, source: 'healthy', cached: false, timestamp: 0, latencyMs: 0 }),
        getAssetInfo: async () => ({ data: {} as any, source: 'healthy', cached: false, timestamp: 0, latencyMs: 0 }),
        healthCheck: async () => true,
      };

      const unhealthyFetcher: Fetcher = {
        name: 'unhealthy',
        supportedTypes: ['stock'],
        getHistoricalData: async () => ({ data: [], source: 'unhealthy', cached: false, timestamp: 0, latencyMs: 0 }),
        getCurrentPrice: async () => ({ data: {} as any, source: 'unhealthy', cached: false, timestamp: 0, latencyMs: 0 }),
        getAssetInfo: async () => ({ data: {} as any, source: 'unhealthy', cached: false, timestamp: 0, latencyMs: 0 }),
        healthCheck: async () => false,
      };

      fetcherRegistry.register(healthyFetcher);
      fetcherRegistry.register(unhealthyFetcher);

      const results = await fetcherRegistry.healthCheckAll();

      expect(results.get('healthy')).toBe(true);
      expect(results.get('unhealthy')).toBe(false);
    });

    test('should handle errors as unhealthy', async () => {
      const errorFetcher: Fetcher = {
        name: 'error',
        supportedTypes: ['crypto'],
        getHistoricalData: async () => ({ data: [], source: 'error', cached: false, timestamp: 0, latencyMs: 0 }),
        getCurrentPrice: async () => ({ data: {} as any, source: 'error', cached: false, timestamp: 0, latencyMs: 0 }),
        getAssetInfo: async () => ({ data: {} as any, source: 'error', cached: false, timestamp: 0, latencyMs: 0 }),
        healthCheck: async () => {
          throw new Error('Health check failed');
        },
      };

      fetcherRegistry.register(errorFetcher);

      const results = await fetcherRegistry.healthCheckAll();
      expect(results.get('error')).toBe(false);
    });
  });
});

describe('initializeDefaultFetchers', () => {
  beforeEach(() => {
    fetcherRegistry.clear();
  });

  test('should register binance and yahoo fetchers', async () => {
    await initializeDefaultFetchers();

    expect(fetcherRegistry.get('binance')).toBeDefined();
    expect(fetcherRegistry.get('yahoo')).toBeDefined();
    expect(fetcherRegistry.list()).toHaveLength(2);
  });
});
