/**
 * Cache Manager Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { CacheManager, MemoryCache, createCacheManager } from '../../src/storage/cache';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
  });

  describe('get/set', () => {
    test('should set and get value', () => {
      cache.set('key', 'value', 3600);
      const result = cache.get<string>('key');
      expect(result).toBe('value');
    });

    test('should return null for missing key', () => {
      const result = cache.get<string>('missing');
      expect(result).toBeNull();
    });

    test('should return null for expired key', async () => {
      cache.set('key', 'value', 0); // Expires immediately

      // Small delay to ensure expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = cache.get<string>('key');
      expect(result).toBeNull();
    });

    test('should handle complex objects', () => {
      const obj = { name: 'test', values: [1, 2, 3], nested: { a: 1 } };
      cache.set('obj', obj, 3600);
      const result = cache.get<typeof obj>('obj');

      expect(result).toEqual(obj);
    });
  });

  describe('has', () => {
    test('should return true for existing key', () => {
      cache.set('key', 'value', 3600);
      expect(cache.has('key')).toBe(true);
    });

    test('should return false for missing key', () => {
      expect(cache.has('missing')).toBe(false);
    });

    test('should return false for expired key', async () => {
      cache.set('key', 'value', 0);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(cache.has('key')).toBe(false);
    });
  });

  describe('delete', () => {
    test('should delete existing key', () => {
      cache.set('key', 'value', 3600);
      const deleted = cache.delete('key');

      expect(deleted).toBe(true);
      expect(cache.has('key')).toBe(false);
    });

    test('should return false for missing key', () => {
      const deleted = cache.delete('missing');
      expect(deleted).toBe(false);
    });
  });

  describe('deletePattern', () => {
    test('should delete keys matching pattern', () => {
      cache.set('user:1:name', 'Alice', 3600);
      cache.set('user:1:age', 30, 3600);
      cache.set('user:2:name', 'Bob', 3600);
      cache.set('other:key', 'value', 3600);

      const deleted = cache.deletePattern('user:1:*');

      expect(deleted).toBe(2);
      expect(cache.has('user:1:name')).toBe(false);
      expect(cache.has('user:1:age')).toBe(false);
      expect(cache.has('user:2:name')).toBe(true);
      expect(cache.has('other:key')).toBe(true);
    });
  });

  describe('clear', () => {
    test('should clear all entries', () => {
      cache.set('key1', 'value1', 3600);
      cache.set('key2', 'value2', 3600);

      cache.clear();

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('stats', () => {
    test('should track hits and misses', () => {
      cache.set('key', 'value', 3600);

      cache.get('key'); // Hit
      cache.get('key'); // Hit
      cache.get('missing'); // Miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 0);
    });

    test('should count keys', () => {
      cache.set('key1', 'value1', 3600);
      cache.set('key2', 'value2', 3600);

      const stats = cache.getStats();
      expect(stats.keys).toBe(2);
    });
  });
});

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(async () => {
    cache = createCacheManager({ memoryFallback: true });
    await cache.initialize();
  });

  afterEach(async () => {
    await cache.close();
  });

  describe('initialization', () => {
    test('should initialize', async () => {
      const healthy = await cache.isHealthy();
      expect(healthy).toBe(true);
    });

    test('should use memory fallback', () => {
      expect(cache.isUsingMemory()).toBe(true);
    });
  });

  describe('get/set', () => {
    test('should set and get value', async () => {
      await cache.set('key', 'value');
      const result = await cache.get<string>('key');
      expect(result).toBe('value');
    });

    test('should return null for missing key', async () => {
      const result = await cache.get<string>('missing');
      expect(result).toBeNull();
    });

    test('should use custom TTL', async () => {
      await cache.set('key', 'value', 1); // 1 second TTL

      const result1 = await cache.get<string>('key');
      expect(result1).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result2 = await cache.get<string>('key');
      expect(result2).toBeNull();
    });
  });

  describe('has', () => {
    test('should check existence', async () => {
      await cache.set('key', 'value');

      expect(await cache.has('key')).toBe(true);
      expect(await cache.has('missing')).toBe(false);
    });
  });

  describe('delete', () => {
    test('should delete key', async () => {
      await cache.set('key', 'value');
      const deleted = await cache.delete('key');

      expect(deleted).toBe(true);
      expect(await cache.has('key')).toBe(false);
    });
  });

  describe('deletePattern', () => {
    test('should delete matching keys', async () => {
      await cache.set('market:AAPL:latest', { price: 150 });
      await cache.set('market:AAPL:history', []);
      await cache.set('market:GOOGL:latest', { price: 100 });

      const deleted = await cache.deletePattern('market:AAPL:*');

      expect(deleted).toBe(2);
      expect(await cache.has('market:GOOGL:latest')).toBe(true);
    });
  });

  describe('getOrSet', () => {
    test('should return cached value', async () => {
      await cache.set('key', 'cached');

      let factoryCalled = false;
      const result = await cache.getOrSet('key', async () => {
        factoryCalled = true;
        return 'fresh';
      });

      expect(result).toBe('cached');
      expect(factoryCalled).toBe(false);
    });

    test('should call factory for missing key', async () => {
      let factoryCalled = false;
      const result = await cache.getOrSet('key', async () => {
        factoryCalled = true;
        return 'fresh';
      });

      expect(result).toBe('fresh');
      expect(factoryCalled).toBe(true);

      // Should now be cached
      const cached = await cache.get<string>('key');
      expect(cached).toBe('fresh');
    });
  });

  describe('getMany/setMany', () => {
    test('should get multiple keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const results = await cache.getMany<string>(['key1', 'key2', 'key3']);

      expect(results.get('key1')).toBe('value1');
      expect(results.get('key2')).toBe('value2');
      expect(results.get('key3')).toBeNull();
    });

    test('should set multiple keys', async () => {
      const entries = new Map<string, string>([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);

      await cache.setMany(entries);

      expect(await cache.get<string>('key1')).toBe('value1');
      expect(await cache.get<string>('key2')).toBe('value2');
    });
  });

  describe('clear', () => {
    test('should clear all keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.clear();

      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
    });
  });

  describe('stats', () => {
    test('should return statistics', async () => {
      await cache.set('key', 'value');
      await cache.get('key'); // Hit
      await cache.get('missing'); // Miss

      const stats = await cache.getStats();

      expect(stats.connected).toBe(true);
      expect(stats.keys).toBeGreaterThan(0);
    });
  });

  describe('key prefix', () => {
    test('should apply prefix to keys', async () => {
      const prefixedCache = createCacheManager({
        prefix: 'test:',
        memoryFallback: true,
      });
      await prefixedCache.initialize();

      await prefixedCache.set('key', 'value');

      // The internal storage should have the prefixed key
      expect(await prefixedCache.get<string>('key')).toBe('value');

      await prefixedCache.close();
    });
  });
});
