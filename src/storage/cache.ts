/**
 * Cache Manager
 * Redis caching with memory fallback
 */

import type {
  CacheConfig,
  CacheEntry,
  CacheStats,
  StorageManager,
} from './types';

/** Default cache configuration */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  host: 'localhost',
  port: 6379,
  db: 0,
  defaultTtl: 3600, // 1 hour
  prefix: 'maxtrade:',
  memoryFallback: true,
};

/**
 * Memory Cache
 * In-memory cache implementation for fallback
 */
export class MemoryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private hits = 0;
  private misses = 0;

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      createdAt: Date.now(),
    };
    this.cache.set(key, entry as CacheEntry);
  }

  /**
   * Delete key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete keys matching pattern
   */
  deletePattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    // Clean expired entries first
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }

    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
      keys: this.cache.size,
      connected: true,
    };
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

/**
 * Redis Client Interface
 * Minimal interface for Redis operations
 */
interface RedisClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  info(): Promise<string>;
  ping(): Promise<string>;
}

/**
 * Cache Manager
 * Handles caching with Redis and memory fallback
 */
export class CacheManager implements StorageManager {
  private config: CacheConfig;
  private redis: RedisClient | null = null;
  private memoryCache: MemoryCache;
  private useMemory = false;
  private initialized = false;
  private hits = 0;
  private misses = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.memoryCache = new MemoryCache();
  }

  /**
   * Initialize cache connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Try to connect to Redis
    if (this.config.url || this.config.host) {
      try {
        // Note: In a real implementation, you would use a Redis client library
        // For now, we'll fall back to memory cache
        // this.redis = await createRedisClient(this.config);
        // await this.redis.connect();
        this.useMemory = true;
      } catch {
        if (this.config.memoryFallback) {
          this.useMemory = true;
        } else {
          throw new Error('Redis connection failed and memory fallback disabled');
        }
      }
    } else {
      this.useMemory = true;
    }

    this.initialized = true;
  }

  /**
   * Close cache connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      this.redis = null;
    }
    this.memoryCache.clear();
    this.initialized = false;
  }

  /**
   * Check if cache is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (this.useMemory) {
      return true;
    }

    try {
      if (!this.redis) return false;
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.prefixKey(key);

    if (this.useMemory) {
      const value = this.memoryCache.get<T>(prefixedKey);
      if (value !== null) {
        this.hits++;
      } else {
        this.misses++;
      }
      return value;
    }

    try {
      const value = await this.redis!.get(prefixedKey);
      if (value === null) {
        this.misses++;
        return null;
      }
      this.hits++;
      return JSON.parse(value) as T;
    } catch {
      // Fall back to memory cache
      return this.memoryCache.get<T>(prefixedKey);
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    const ttlSeconds = ttl ?? this.config.defaultTtl ?? 3600;

    if (this.useMemory) {
      this.memoryCache.set(prefixedKey, value, ttlSeconds);
      return;
    }

    try {
      await this.redis!.set(prefixedKey, JSON.stringify(value), {
        EX: ttlSeconds,
      });
    } catch {
      // Fall back to memory cache
      this.memoryCache.set(prefixedKey, value, ttlSeconds);
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);

    if (this.useMemory) {
      return this.memoryCache.delete(prefixedKey);
    }

    try {
      const result = await this.redis!.del(prefixedKey);
      return result > 0;
    } catch {
      return this.memoryCache.delete(prefixedKey);
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);

    if (this.useMemory) {
      return this.memoryCache.has(prefixedKey);
    }

    try {
      const result = await this.redis!.exists(prefixedKey);
      return result > 0;
    } catch {
      return this.memoryCache.has(prefixedKey);
    }
  }

  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const prefixedPattern = this.prefixKey(pattern);

    if (this.useMemory) {
      return this.memoryCache.deletePattern(prefixedPattern);
    }

    try {
      const keys = await this.redis!.keys(prefixedPattern);
      let deleted = 0;
      for (const key of keys) {
        await this.redis!.del(key);
        deleted++;
      }
      return deleted;
    } catch {
      return this.memoryCache.deletePattern(prefixedPattern);
    }
  }

  /**
   * Get or set with factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Get multiple keys
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    for (const key of keys) {
      const value = await this.get<T>(key);
      results.set(key, value);
    }

    return results;
  }

  /**
   * Set multiple keys
   */
  async setMany<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    for (const [key, value] of entries) {
      await this.set(key, value, ttl);
    }
  }

  /**
   * Clear all cache entries with prefix
   */
  async clear(): Promise<void> {
    if (this.useMemory) {
      this.memoryCache.clear();
      return;
    }

    await this.deletePattern('*');
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (this.useMemory) {
      const memStats = this.memoryCache.getStats();
      return {
        ...memStats,
        hits: this.hits + memStats.hits,
        misses: this.misses + memStats.misses,
        hitRate:
          this.hits + this.misses > 0
            ? ((this.hits + memStats.hits) /
                (this.hits + this.misses + memStats.hits + memStats.misses)) *
              100
            : 0,
      };
    }

    try {
      const info = await this.redis!.info();
      const keys = await this.redis!.keys(this.prefixKey('*'));

      // Parse Redis INFO response
      const hitsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);
      const memoryMatch = info.match(/used_memory:(\d+)/);

      const redisHits = hitsMatch ? parseInt(hitsMatch[1], 10) : 0;
      const redisMisses = missesMatch ? parseInt(missesMatch[1], 10) : 0;
      const total = redisHits + redisMisses;

      return {
        hits: this.hits + redisHits,
        misses: this.misses + redisMisses,
        hitRate: total > 0 ? (redisHits / total) * 100 : 0,
        keys: keys.length,
        memoryUsed: memoryMatch ? parseInt(memoryMatch[1], 10) : undefined,
        connected: true,
      };
    } catch {
      return this.memoryCache.getStats();
    }
  }

  /**
   * Check if using memory fallback
   */
  isUsingMemory(): boolean {
    return this.useMemory;
  }

  /**
   * Add prefix to key
   */
  private prefixKey(key: string): string {
    return `${this.config.prefix ?? ''}${key}`;
  }
}

/**
 * Create cache manager instance
 */
export function createCacheManager(
  config: Partial<CacheConfig> = {}
): CacheManager {
  return new CacheManager(config);
}
