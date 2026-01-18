/**
 * Strategy Registry Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { strategyRegistry } from '../../src/strategies/registry';
import { MomentumStrategy } from '../../src/strategies/builtin/momentum';
import { ValueStrategy } from '../../src/strategies/builtin/value';
import { LowVolatilityStrategy } from '../../src/strategies/builtin/low-volatility';

describe('StrategyRegistry', () => {
  beforeEach(() => {
    strategyRegistry.clear();
  });

  test('should register and create strategies', () => {
    strategyRegistry.register(MomentumStrategy);

    const strategy = strategyRegistry.create('momentum');

    expect(strategy.name).toBe('momentum');
    expect(strategy.riskLevel).toBe('high');
  });

  test('should list registered strategies', () => {
    strategyRegistry.register(MomentumStrategy);
    strategyRegistry.register(ValueStrategy);

    const list = strategyRegistry.list();

    expect(list).toContain('momentum');
    expect(list).toContain('value');
  });

  test('should throw for unknown strategy', () => {
    expect(() => strategyRegistry.create('unknown')).toThrow();
  });

  test('should create strategy with custom parameters', () => {
    strategyRegistry.register(MomentumStrategy);

    const strategy = strategyRegistry.create('momentum', {
      buyThreshold: 80,
      maxPositions: 5,
    });

    expect(strategy.parameters.buyThreshold).toBe(80);
    expect(strategy.parameters.maxPositions).toBe(5);
  });

  test('should get strategy metadata', () => {
    strategyRegistry.register(MomentumStrategy);

    const metadata = strategyRegistry.getMetadata('momentum');

    expect(metadata).toBeDefined();
    expect(metadata!.name).toBe('momentum');
    expect(metadata!.description.toLowerCase()).toContain('trend');
    expect(metadata!.riskLevel).toBe('high');
    expect(metadata!.paramDefinitions.length).toBeGreaterThan(0);
  });

  test('should unregister strategies', () => {
    strategyRegistry.register(MomentumStrategy);
    expect(strategyRegistry.has('momentum')).toBe(true);

    strategyRegistry.unregister('momentum');
    expect(strategyRegistry.has('momentum')).toBe(false);
  });

  test('should get strategies by risk level', () => {
    strategyRegistry.register(MomentumStrategy); // high
    strategyRegistry.register(ValueStrategy); // medium
    strategyRegistry.register(LowVolatilityStrategy); // low

    const highRisk = strategyRegistry.getByRiskLevel('high');
    const lowRisk = strategyRegistry.getByRiskLevel('low');

    expect(highRisk).toContain('momentum');
    expect(lowRisk).toContain('low-volatility');
  });
});
