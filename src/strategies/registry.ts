/**
 * Strategy Registry
 * Service Locator pattern for managing trading strategies
 */

import type {
  Strategy,
  StrategyRegistry as IStrategyRegistry,
  StrategyParams,
  RiskLevel,
  ParamDefinition,
} from './types';

class StrategyRegistryImpl implements IStrategyRegistry {
  private strategies: Map<string, new () => Strategy> = new Map();

  /** Register a strategy class */
  register<T extends Strategy>(
    strategyClass: new () => T,
    name?: string
  ): void {
    // Create a temporary instance to get the name
    const temp = new strategyClass();
    const strategyName = name ?? temp.name;

    if (this.strategies.has(strategyName)) {
      console.warn(`Strategy ${strategyName} already registered, replacing`);
    }

    this.strategies.set(strategyName, strategyClass as new () => Strategy);
  }

  /** Create a strategy instance with optional parameters */
  create(name: string, params?: StrategyParams): Strategy {
    const StrategyClass = this.strategies.get(name);

    if (!StrategyClass) {
      throw new Error(`Strategy "${name}" not found. Available: ${this.list().join(', ')}`);
    }

    const instance = new StrategyClass();

    if (params) {
      instance.setParams(params);
    }

    return instance;
  }

  /** Get a strategy class by name */
  get(name: string): (new () => Strategy) | undefined {
    return this.strategies.get(name);
  }

  /** List all registered strategy names */
  list(): string[] {
    return Array.from(this.strategies.keys());
  }

  /** Get metadata for a strategy */
  getMetadata(name: string): {
    name: string;
    description: string;
    riskLevel: RiskLevel;
    paramDefinitions: ParamDefinition[];
  } | undefined {
    const StrategyClass = this.strategies.get(name);
    if (!StrategyClass) return undefined;

    const temp = new StrategyClass();
    return {
      name: temp.name,
      description: temp.description,
      riskLevel: temp.riskLevel,
      paramDefinitions: temp.paramDefinitions,
    };
  }

  /** Unregister a strategy */
  unregister(name: string): boolean {
    return this.strategies.delete(name);
  }

  /** Clear all registered strategies */
  clear(): void {
    this.strategies.clear();
  }

  /** Get strategies by risk level */
  getByRiskLevel(riskLevel: RiskLevel): string[] {
    const result: string[] = [];

    for (const [name, StrategyClass] of this.strategies) {
      const temp = new StrategyClass();
      if (temp.riskLevel === riskLevel) {
        result.push(name);
      }
    }

    return result;
  }

  /** Check if a strategy is registered */
  has(name: string): boolean {
    return this.strategies.has(name);
  }
}

/** Global strategy registry singleton */
export const strategyRegistry = new StrategyRegistryImpl();

/** Initialize built-in strategies */
export async function initializeBuiltinStrategies(): Promise<void> {
  const { MomentumStrategy } = await import('./builtin/momentum');
  const { ValueStrategy } = await import('./builtin/value');
  const { QualityGrowthStrategy } = await import('./builtin/quality-growth');
  const { MultiFactorStrategy } = await import('./builtin/multi-factor');
  const { MeanReversionStrategy } = await import('./builtin/mean-reversion');
  const { LowVolatilityStrategy } = await import('./builtin/low-volatility');

  strategyRegistry.register(MomentumStrategy);
  strategyRegistry.register(ValueStrategy);
  strategyRegistry.register(QualityGrowthStrategy);
  strategyRegistry.register(MultiFactorStrategy);
  strategyRegistry.register(MeanReversionStrategy);
  strategyRegistry.register(LowVolatilityStrategy);
}
