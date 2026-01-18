/**
 * Cache Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { MemoryCache, cacheKey } from '../../src/fetchers/cache';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache({ defaultTTL: 1000, maxSize: 100 });
  });

  test('should store and retrieve values', () => {
    cache.set('key1', { value: 'test' });
    expect(cache.get('key1')).toEqual({ value: 'test' });
  });

  test('should return undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  test('should expire entries after TTL', async () => {
    cache.set('expiring', 'value', 50); // 50ms TTL
    expect(cache.get('expiring')).toBe('value');

    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get('expiring')).toBeUndefined();
  });

  test('should track hit/miss statistics', () => {
    cache.set('exists', 'value');

    cache.get('exists'); // hit
    cache.get('exists'); // hit
    cache.get('missing'); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.667, 2);
  });

  test('should delete entries', () => {
    cache.set('toDelete', 'value');
    expect(cache.has('toDelete')).toBe(true);

    cache.delete('toDelete');
    expect(cache.has('toDelete')).toBe(false);
  });

  test('should clear all entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    cache.clear();

    expect(cache.getStats().size).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
  });

  test('should evict oldest when at capacity', () => {
    const smallCache = new MemoryCache({ defaultTTL: 10000, maxSize: 3 });

    smallCache.set('key1', 'value1');
    smallCache.set('key2', 'value2');
    smallCache.set('key3', 'value3');
    smallCache.set('key4', 'value4'); // Should trigger eviction

    // At least one old key should be evicted
    const stats = smallCache.getStats();
    expect(stats.size).toBeLessThanOrEqual(3);
  });

  test('should cleanup expired entries', async () => {
    cache.set('short', 'value', 30);
    cache.set('long', 'value', 10000);

    await new Promise((r) => setTimeout(r, 50));

    const cleaned = cache.cleanup();
    expect(cleaned).toBe(1);
    expect(cache.has('short')).toBe(false);
    expect(cache.has('long')).toBe(true);
  });
});

describe('cacheKey', () => {
  test('should generate consistent keys', () => {
    const key = cacheKey('binance', 'historical', 'BTCUSDT', '1h');
    expect(key).toBe('binance:historical:BTCUSDT:1h');
  });

  test('should filter undefined values', () => {
    const key = cacheKey('yahoo', 'quote', 'AAPL', undefined, 100);
    expect(key).toBe('yahoo:quote:AAPL:100');
  });
});
