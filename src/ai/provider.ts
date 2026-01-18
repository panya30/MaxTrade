/**
 * LLM Provider Abstraction
 * Base class for LLM integrations
 */

import type {
  LLMResponse,
  ModelInfo,
  ProviderConfig,
  GenerationOptions,
  ProviderStatus,
} from './types';

/** Default generation options */
export const DEFAULT_OPTIONS: GenerationOptions = {
  temperature: 0.3,
  maxTokens: 1024,
  topP: 1,
  presencePenalty: 0,
  frequencyPenalty: 0,
};

/**
 * Abstract LLM Provider
 * Defines the interface for all LLM integrations
 */
export abstract class LLMProvider {
  protected config: ProviderConfig;
  protected status: ProviderStatus = {
    available: true,
    consecutiveFailures: 0,
  };

  constructor(config: ProviderConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      ...config,
    };
  }

  /**
   * Generate a response from the LLM
   */
  abstract generate(
    prompt: string,
    options?: GenerationOptions
  ): Promise<LLMResponse>;

  /**
   * Generate with messages (chat format)
   */
  abstract generateChat(
    messages: Array<{ role: string; content: string }>,
    options?: GenerationOptions
  ): Promise<LLMResponse>;

  /**
   * Get model information
   */
  abstract getModelInfo(model?: string): ModelInfo;

  /**
   * List available models
   */
  abstract listModels(): string[];

  /**
   * Get provider name
   */
  abstract getProviderName(): string;

  /**
   * Get current provider status
   */
  getStatus(): ProviderStatus {
    return { ...this.status };
  }

  /**
   * Check if provider is available
   */
  isAvailable(): boolean {
    // Consider unavailable after 5 consecutive failures
    return this.status.consecutiveFailures < 5;
  }

  /**
   * Record a successful call
   */
  protected recordSuccess(): void {
    this.status.available = true;
    this.status.consecutiveFailures = 0;
    this.status.lastSuccess = Date.now();
    this.status.lastError = undefined;
  }

  /**
   * Record a failed call
   */
  protected recordFailure(error: string): void {
    this.status.consecutiveFailures++;
    this.status.lastError = error;
    if (this.status.consecutiveFailures >= 5) {
      this.status.available = false;
    }
  }

  /**
   * Calculate cost from token usage
   */
  protected calculateCost(
    promptTokens: number,
    completionTokens: number,
    model: string
  ): number {
    const info = this.getModelInfo(model);
    return (
      (promptTokens * info.inputCostPer1k +
        completionTokens * info.outputCostPer1k) /
      1000
    );
  }

  /**
   * Merge options with defaults
   */
  protected mergeOptions(options?: GenerationOptions): GenerationOptions {
    return {
      ...DEFAULT_OPTIONS,
      model: this.config.defaultModel,
      ...options,
    };
  }

  /**
   * Retry with exponential backoff
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = this.config.maxRetries ?? 3
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        this.recordSuccess();
        return result;
      } catch (error) {
        lastError = error as Error;
        this.recordFailure(lastError.message);

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, ...
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

/**
 * Provider Registry
 * Manages multiple LLM providers with fallback
 */
export class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  private primaryProvider: string | null = null;
  private fallbackChain: string[] = [];

  /**
   * Register a provider
   */
  register(name: string, provider: LLMProvider, isPrimary = false): void {
    this.providers.set(name, provider);
    if (isPrimary || this.primaryProvider === null) {
      this.primaryProvider = name;
    }
  }

  /**
   * Set fallback chain
   */
  setFallbackChain(chain: string[]): void {
    this.fallbackChain = chain.filter((name) => this.providers.has(name));
  }

  /**
   * Get a specific provider
   */
  get(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get the best available provider
   */
  getAvailable(): LLMProvider | null {
    // Try primary first
    if (this.primaryProvider) {
      const primary = this.providers.get(this.primaryProvider);
      if (primary?.isAvailable()) {
        return primary;
      }
    }

    // Try fallback chain
    for (const name of this.fallbackChain) {
      const provider = this.providers.get(name);
      if (provider?.isAvailable()) {
        return provider;
      }
    }

    // Try any available
    for (const provider of this.providers.values()) {
      if (provider.isAvailable()) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Generate with automatic fallback
   */
  async generate(
    prompt: string,
    options?: GenerationOptions
  ): Promise<LLMResponse> {
    const providers = this.getProviderChain();

    let lastError: Error | undefined;

    for (const provider of providers) {
      try {
        return await provider.generate(prompt, options);
      } catch (error) {
        lastError = error as Error;
        // Continue to next provider
      }
    }

    throw new Error(
      `All providers failed. Last error: ${lastError?.message ?? 'Unknown error'}`
    );
  }

  /**
   * Get ordered provider chain
   */
  private getProviderChain(): LLMProvider[] {
    const chain: LLMProvider[] = [];

    // Primary first
    if (this.primaryProvider) {
      const primary = this.providers.get(this.primaryProvider);
      if (primary?.isAvailable()) {
        chain.push(primary);
      }
    }

    // Then fallback chain
    for (const name of this.fallbackChain) {
      if (name !== this.primaryProvider) {
        const provider = this.providers.get(name);
        if (provider?.isAvailable()) {
          chain.push(provider);
        }
      }
    }

    return chain;
  }

  /**
   * List registered provider names
   */
  list(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get status of all providers
   */
  getStatuses(): Map<string, ProviderStatus> {
    const statuses = new Map<string, ProviderStatus>();
    for (const [name, provider] of this.providers) {
      statuses.set(name, provider.getStatus());
    }
    return statuses;
  }
}

/** Global provider registry */
export const providerRegistry = new ProviderRegistry();
