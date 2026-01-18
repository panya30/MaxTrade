/**
 * Provider Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  LLMProvider,
  ProviderRegistry,
  providerRegistry,
  DEFAULT_OPTIONS,
} from '../../src/ai/provider';
import type {
  LLMResponse,
  ModelInfo,
  ProviderConfig,
  GenerationOptions,
} from '../../src/ai/types';

/** Mock provider for testing */
class MockProvider extends LLMProvider {
  public shouldFail = false;
  public failCount = 0;
  public callCount = 0;

  constructor(config: ProviderConfig = { apiKey: 'test' }) {
    super(config);
  }

  async generate(prompt: string, options?: GenerationOptions): Promise<LLMResponse> {
    return this.withRetry(async () => {
      this.callCount++;

      if (this.shouldFail) {
        this.failCount++;
        throw new Error('Mock failure');
      }

      return {
        content: `Response to: ${prompt}`,
        confidence: 0.9,
        tokensUsed: 100,
        promptTokens: 50,
        completionTokens: 50,
        cost: 0.001,
        model: options?.model ?? 'mock',
        latencyMs: 50,
      };
    });
  }

  async generateChat(
    messages: Array<{ role: string; content: string }>,
    options?: GenerationOptions
  ): Promise<LLMResponse> {
    const lastMessage = messages[messages.length - 1];
    return this.generate(lastMessage.content, options);
  }

  getModelInfo(model?: string): ModelInfo {
    return {
      id: model ?? 'mock',
      provider: 'openai',
      maxTokens: 4096,
      inputCostPer1k: 0.001,
      outputCostPer1k: 0.002,
      supportsReasoning: false,
    };
  }

  listModels(): string[] {
    return ['mock', 'mock-large'];
  }

  getProviderName(): string {
    return 'mock';
  }
}

describe('LLMProvider', () => {
  describe('status tracking', () => {
    test('should start as available', () => {
      const provider = new MockProvider();
      expect(provider.isAvailable()).toBe(true);
    });

    test('should track consecutive failures', async () => {
      const provider = new MockProvider({ apiKey: 'test', maxRetries: 0 });
      provider.shouldFail = true;

      for (let i = 0; i < 3; i++) {
        try {
          await provider.generate('test');
        } catch {
          // Expected
        }
      }

      const status = provider.getStatus();
      expect(status.consecutiveFailures).toBe(3);
      expect(status.lastError).toBeDefined();
    });

    test('should become unavailable after 5 failures', async () => {
      const provider = new MockProvider({ apiKey: 'test', maxRetries: 0 });
      provider.shouldFail = true;

      for (let i = 0; i < 5; i++) {
        try {
          await provider.generate('test');
        } catch {
          // Expected
        }
      }

      expect(provider.isAvailable()).toBe(false);
    });

    test('should reset failures on success', async () => {
      const provider = new MockProvider({ apiKey: 'test', maxRetries: 0 });
      provider.shouldFail = true;

      try {
        await provider.generate('test');
      } catch {
        // Expected
      }

      provider.shouldFail = false;
      await provider.generate('test');

      const status = provider.getStatus();
      expect(status.consecutiveFailures).toBe(0);
      expect(status.lastSuccess).toBeDefined();
    });
  });

  describe('cost calculation', () => {
    test('should calculate cost from tokens', () => {
      const provider = new MockProvider();
      const info = provider.getModelInfo();

      // Access protected method via any
      const cost = (provider as any).calculateCost(100, 50, 'mock');

      // (100 * 0.001 + 50 * 0.002) / 1000 = 0.0002
      expect(cost).toBeCloseTo(0.0002, 6);
    });
  });

  describe('options merging', () => {
    test('should merge with defaults', () => {
      const provider = new MockProvider({ apiKey: 'test', defaultModel: 'custom' });
      const merged = (provider as any).mergeOptions({ temperature: 0.5 });

      expect(merged.temperature).toBe(0.5);
      expect(merged.maxTokens).toBe(DEFAULT_OPTIONS.maxTokens);
      expect(merged.model).toBe('custom');
    });

    test('should override defaults', () => {
      const provider = new MockProvider();
      const merged = (provider as any).mergeOptions({
        temperature: 0.9,
        maxTokens: 2048,
      });

      expect(merged.temperature).toBe(0.9);
      expect(merged.maxTokens).toBe(2048);
    });
  });
});

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;
  let primaryProvider: MockProvider;
  let fallbackProvider: MockProvider;

  beforeEach(() => {
    registry = new ProviderRegistry();
    primaryProvider = new MockProvider();
    fallbackProvider = new MockProvider();
  });

  describe('registration', () => {
    test('should register provider', () => {
      registry.register('primary', primaryProvider);

      expect(registry.get('primary')).toBe(primaryProvider);
      expect(registry.list()).toContain('primary');
    });

    test('should set first provider as primary', () => {
      registry.register('first', primaryProvider);
      registry.register('second', fallbackProvider);

      expect(registry.getAvailable()).toBe(primaryProvider);
    });

    test('should allow explicit primary', () => {
      registry.register('first', primaryProvider);
      registry.register('second', fallbackProvider, true);

      expect(registry.getAvailable()).toBe(fallbackProvider);
    });
  });

  describe('fallback chain', () => {
    test('should set fallback chain', () => {
      registry.register('primary', primaryProvider);
      registry.register('fallback', fallbackProvider);
      registry.setFallbackChain(['primary', 'fallback']);

      expect(registry.list()).toHaveLength(2);
    });

    test('should ignore non-existent providers in chain', () => {
      registry.register('primary', primaryProvider);
      registry.setFallbackChain(['primary', 'nonexistent']);

      // Should not throw
      expect(registry.getAvailable()).toBe(primaryProvider);
    });
  });

  describe('getAvailable', () => {
    test('should return primary if available', () => {
      registry.register('primary', primaryProvider);
      registry.register('fallback', fallbackProvider);

      expect(registry.getAvailable()).toBe(primaryProvider);
    });

    test('should return fallback when primary unavailable', async () => {
      const primary = new MockProvider({ apiKey: 'test', maxRetries: 0 });
      const fallback = new MockProvider({ apiKey: 'test', maxRetries: 0 });
      registry.register('primary', primary);
      registry.register('fallback', fallback);
      registry.setFallbackChain(['primary', 'fallback']);

      // Make primary unavailable
      primary.shouldFail = true;
      for (let i = 0; i < 5; i++) {
        try {
          await primary.generate('test');
        } catch {
          // Expected
        }
      }

      expect(registry.getAvailable()).toBe(fallback);
    });

    test('should return null when all unavailable', async () => {
      const onlyProvider = new MockProvider({ apiKey: 'test', maxRetries: 0 });
      registry.register('primary', onlyProvider);
      onlyProvider.shouldFail = true;

      for (let i = 0; i < 5; i++) {
        try {
          await onlyProvider.generate('test');
        } catch {
          // Expected
        }
      }

      expect(registry.getAvailable()).toBeNull();
    });
  });

  describe('generate with fallback', () => {
    test('should use primary on success', async () => {
      const primary = new MockProvider({ apiKey: 'test', maxRetries: 0 });
      const fallback = new MockProvider({ apiKey: 'test', maxRetries: 0 });
      registry.register('primary', primary, true);
      registry.register('fallback', fallback);
      registry.setFallbackChain(['primary', 'fallback']);

      await registry.generate('test');

      expect(primary.callCount).toBe(1);
      expect(fallback.callCount).toBe(0);
    });

    test('should fallback on failure', async () => {
      const primary = new MockProvider({ apiKey: 'test', maxRetries: 0 });
      const fallback = new MockProvider({ apiKey: 'test', maxRetries: 0 });
      registry.register('primary', primary, true);
      registry.register('fallback', fallback);
      registry.setFallbackChain(['primary', 'fallback']);

      primary.shouldFail = true;

      const response = await registry.generate('test');

      expect(response.content).toContain('Response to');
      expect(fallback.callCount).toBe(1);
    });

    test('should throw when all providers fail', async () => {
      const primary = new MockProvider({ apiKey: 'test', maxRetries: 0 });
      const fallback = new MockProvider({ apiKey: 'test', maxRetries: 0 });
      registry.register('primary', primary, true);
      registry.register('fallback', fallback);
      registry.setFallbackChain(['primary', 'fallback']);

      primary.shouldFail = true;
      fallback.shouldFail = true;

      await expect(registry.generate('test')).rejects.toThrow('All providers failed');
    });
  });

  describe('getStatuses', () => {
    test('should return status of all providers', () => {
      registry.register('primary', primaryProvider);
      registry.register('fallback', fallbackProvider);

      const statuses = registry.getStatuses();

      expect(statuses.size).toBe(2);
      expect(statuses.get('primary')).toBeDefined();
      expect(statuses.get('fallback')).toBeDefined();
    });
  });
});

describe('DEFAULT_OPTIONS', () => {
  test('should have reasonable defaults', () => {
    expect(DEFAULT_OPTIONS.temperature).toBe(0.3);
    expect(DEFAULT_OPTIONS.maxTokens).toBe(1024);
    expect(DEFAULT_OPTIONS.topP).toBe(1);
  });
});
