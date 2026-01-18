/**
 * In-Memory Cache with TTL
 * Graceful degradation pattern - in-memory first, Redis optional
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

export interface CacheOptions {
  defaultTTL: number; // milliseconds
  maxSize: number;
  onEvict?: (key: string) => void;
}

export class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private options: CacheOptions;
  private hits = 0;
  private misses = 0;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = {
      defaultTTL: 60_000, // 1 minute default
      maxSize: 10_000,
      ...options,
    };
  }

  /** Get value from cache */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.data;
  }

  /** Set value in cache */
  set<T>(key: string, data: T, ttl?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      createdAt: now,
      expiresAt: now + (ttl ?? this.options.defaultTTL),
    });
  }

  /** Delete from cache */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /** Clear all cache */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /** Check if key exists and is not expired */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /** Get cache statistics */
  getStats(): { hits: number; misses: number; hitRate: number; size: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.cache.size,
    };
  }

  /** Evict oldest entries */
  private evictOldest(): void {
    // Evict 10% of oldest entries
    const toEvict = Math.max(1, Math.floor(this.cache.size * 0.1));
    const keys = Array.from(this.cache.keys()).slice(0, toEvict);

    for (const key of keys) {
      this.cache.delete(key);
      this.options.onEvict?.(key);
    }
  }

  /** Clean up expired entries */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/** Generate cache key for fetcher operations */
export function cacheKey(
  fetcher: string,
  operation: string,
  ...args: (string | number | undefined)[]
): string {
  return `${fetcher}:${operation}:${args.filter(Boolean).join(':')}`;
}

/** Shared cache instance */
export const globalCache = new MemoryCache({
  defaultTTL: 60_000, // 1 minute
  maxSize: 50_000,
});
