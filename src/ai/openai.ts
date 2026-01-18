/**
 * OpenAI Provider
 * Integration with OpenAI's GPT models
 */

import type {
  LLMResponse,
  ModelInfo,
  ProviderConfig,
  GenerationOptions,
  OpenAIModel,
} from './types';
import { LLMProvider, DEFAULT_OPTIONS } from './provider';

/** Model pricing (per 1K tokens, USD) - as of Jan 2024 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-0125': { input: 0.0005, output: 0.0015 },
};

/** Model configurations */
const MODEL_INFO: Record<string, ModelInfo> = {
  'gpt-4': {
    id: 'gpt-4',
    provider: 'openai',
    maxTokens: 8192,
    inputCostPer1k: 0.03,
    outputCostPer1k: 0.06,
    supportsReasoning: true,
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    provider: 'openai',
    maxTokens: 128000,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.03,
    supportsReasoning: true,
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    provider: 'openai',
    maxTokens: 16385,
    inputCostPer1k: 0.0005,
    outputCostPer1k: 0.0015,
    supportsReasoning: false,
  },
};

/** OpenAI API message format */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** OpenAI API response */
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Provider Implementation
 */
export class OpenAIProvider extends LLMProvider {
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    super({
      defaultModel: 'gpt-3.5-turbo',
      ...config,
    });
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
  }

  /**
   * Generate a response from a single prompt
   */
  async generate(
    prompt: string,
    options?: GenerationOptions
  ): Promise<LLMResponse> {
    const opts = this.mergeOptions(options);
    const messages: ChatMessage[] = [];

    if (opts.systemPrompt) {
      messages.push({ role: 'system', content: opts.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    return this.generateChat(messages, options);
  }

  /**
   * Generate with chat messages
   */
  async generateChat(
    messages: Array<{ role: string; content: string }>,
    options?: GenerationOptions
  ): Promise<LLMResponse> {
    const opts = this.mergeOptions(options);
    const model = opts.model ?? 'gpt-3.5-turbo';

    const startTime = Date.now();

    const response = await this.withRetry(async () => {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          ...(this.config.organization
            ? { 'OpenAI-Organization': this.config.organization }
            : {}),
        },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          })),
          temperature: opts.temperature,
          max_tokens: opts.maxTokens,
          top_p: opts.topP,
          presence_penalty: opts.presencePenalty,
          frequency_penalty: opts.frequencyPenalty,
          stop: opts.stop,
        }),
        signal: AbortSignal.timeout(this.config.timeout ?? 30000),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(
          `OpenAI API error: ${error.error?.message ?? res.statusText}`
        );
      }

      return res.json() as Promise<OpenAIResponse>;
    });

    const latencyMs = Date.now() - startTime;

    const content = response.choices[0]?.message?.content ?? '';
    const { prompt_tokens, completion_tokens, total_tokens } = response.usage;

    const cost = this.calculateCost(prompt_tokens, completion_tokens, model);

    return {
      content,
      confidence: this.estimateConfidence(response),
      tokensUsed: total_tokens,
      promptTokens: prompt_tokens,
      completionTokens: completion_tokens,
      cost,
      model: response.model,
      latencyMs,
    };
  }

  /**
   * Get model information
   */
  getModelInfo(model?: string): ModelInfo {
    const modelId = model ?? this.config.defaultModel ?? 'gpt-3.5-turbo';
    return (
      MODEL_INFO[modelId] ?? {
        id: modelId,
        provider: 'openai',
        maxTokens: 4096,
        inputCostPer1k: 0.001,
        outputCostPer1k: 0.002,
        supportsReasoning: false,
      }
    );
  }

  /**
   * List available models
   */
  listModels(): string[] {
    return Object.keys(MODEL_INFO);
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'openai';
  }

  /**
   * Estimate confidence based on response characteristics
   */
  private estimateConfidence(response: OpenAIResponse): number {
    // Base confidence on finish reason
    const finishReason = response.choices[0]?.finish_reason;

    if (finishReason === 'stop') {
      return 0.9; // Normal completion
    } else if (finishReason === 'length') {
      return 0.6; // Truncated
    } else if (finishReason === 'content_filter') {
      return 0.3; // Filtered
    }

    return 0.8;
  }
}

/**
 * Create an OpenAI provider instance
 */
export function createOpenAIProvider(config: ProviderConfig): OpenAIProvider {
  return new OpenAIProvider(config);
}

/**
 * Create a provider from environment variables
 */
export function createOpenAIProviderFromEnv(): OpenAIProvider | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new OpenAIProvider({
    apiKey,
    organization: process.env.OPENAI_ORG_ID,
    defaultModel: (process.env.OPENAI_MODEL as OpenAIModel) ?? 'gpt-3.5-turbo',
  });
}
