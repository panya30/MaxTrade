/**
 * Fetcher Registry
 * Service Locator pattern from QuantMuse
 * Manages multiple data sources with type-based lookup
 */

import type { Fetcher, FetcherRegistry, AssetInfo } from './types';

class FetcherRegistryImpl implements FetcherRegistry {
  private fetchers: Map<string, Fetcher> = new Map();

  /** Register a fetcher */
  register(fetcher: Fetcher): void {
    if (this.fetchers.has(fetcher.name)) {
      console.warn(`Fetcher ${fetcher.name} already registered, replacing`);
    }
    this.fetchers.set(fetcher.name, fetcher);
  }

  /** Get fetcher by name */
  get(name: string): Fetcher | undefined {
    return this.fetchers.get(name);
  }

  /** Get all fetchers supporting a specific asset type */
  getForType(type: AssetInfo['type']): Fetcher[] {
    return Array.from(this.fetchers.values()).filter((f) =>
      f.supportedTypes.includes(type)
    );
  }

  /** List all registered fetcher names */
  list(): string[] {
    return Array.from(this.fetchers.keys());
  }

  /** Unregister a fetcher */
  unregister(name: string): boolean {
    return this.fetchers.delete(name);
  }

  /** Clear all fetchers */
  clear(): void {
    this.fetchers.clear();
  }

  /** Check health of all fetchers */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    await Promise.all(
      Array.from(this.fetchers.entries()).map(async ([name, fetcher]) => {
        try {
          const healthy = await fetcher.healthCheck();
          results.set(name, healthy);
        } catch {
          results.set(name, false);
        }
      })
    );

    return results;
  }
}

/** Global fetcher registry singleton */
export const fetcherRegistry = new FetcherRegistryImpl();

/** Initialize default fetchers */
export async function initializeDefaultFetchers(): Promise<void> {
  const { BinanceFetcher } = await import('./binance');
  const { YahooFetcher } = await import('./yahoo');

  fetcherRegistry.register(new BinanceFetcher());
  fetcherRegistry.register(new YahooFetcher());
}
