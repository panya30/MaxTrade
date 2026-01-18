/**
 * AI Module Types
 * Type definitions for LLM integration
 */

/** Supported LLM providers */
export type LLMProviderType = 'openai' | 'anthropic' | 'local';

/** OpenAI model identifiers */
export type OpenAIModel = 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo';

/** LLM response from a provider */
export interface LLMResponse {
  /** Generated content */
  content: string;
  /** Model confidence in response (0-1) */
  confidence: number;
  /** Total tokens used */
  tokensUsed: number;
  /** Prompt tokens */
  promptTokens: number;
  /** Completion tokens */
  completionTokens: number;
  /** Cost in USD */
  cost: number;
  /** Model used */
  model: string;
  /** Response time in ms */
  latencyMs: number;
}

/** Model information */
export interface ModelInfo {
  /** Model identifier */
  id: string;
  /** Provider name */
  provider: LLMProviderType;
  /** Max tokens supported */
  maxTokens: number;
  /** Cost per 1K input tokens */
  inputCostPer1k: number;
  /** Cost per 1K output tokens */
  outputCostPer1k: number;
  /** Is this a reasoning model */
  supportsReasoning: boolean;
}

/** Provider configuration */
export interface ProviderConfig {
  /** API key */
  apiKey: string;
  /** Base URL (for proxies) */
  baseUrl?: string;
  /** Default model */
  defaultModel?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Max retries on failure */
  maxRetries?: number;
  /** Organization ID (OpenAI) */
  organization?: string;
}

/** Generation options */
export interface GenerationOptions {
  /** Model to use */
  model?: string;
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Top-p sampling */
  topP?: number;
  /** Presence penalty */
  presencePenalty?: number;
  /** Frequency penalty */
  frequencyPenalty?: number;
  /** Stop sequences */
  stop?: string[];
  /** System prompt */
  systemPrompt?: string;
}

/** Sentiment analysis result */
export interface SentimentResult {
  /** Sentiment score (-1 to 1) */
  score: number;
  /** Sentiment label */
  label: 'positive' | 'negative' | 'neutral';
  /** Confidence in analysis (0-1) */
  confidence: number;
  /** Key phrases identified */
  keyPhrases: string[];
  /** Method used (llm or keyword) */
  method: 'llm' | 'keyword';
  /** Detailed breakdown if available */
  breakdown?: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

/** Market summary request */
export interface MarketSummaryRequest {
  /** Symbols to analyze */
  symbols: string[];
  /** Price data for context */
  priceChanges?: Map<string, number>;
  /** News headlines if available */
  headlines?: string[];
  /** Timeframe for analysis */
  timeframe?: 'daily' | 'weekly' | 'monthly';
}

/** Market summary response */
export interface MarketSummary {
  /** Overall market sentiment */
  sentiment: SentimentResult;
  /** Key highlights */
  highlights: string[];
  /** Individual stock summaries */
  stockSummaries: Map<string, string>;
  /** Trading recommendations */
  recommendations?: string[];
  /** Generated at timestamp */
  timestamp: number;
  /** Cost of generation */
  cost: number;
}

/** Signal explanation request */
export interface SignalExplanationRequest {
  /** Signal being explained */
  signal: {
    symbol: string;
    action: 'buy' | 'sell' | 'hold';
    strength: number;
    factors: Array<{ name: string; value: number; weight: number }>;
  };
  /** Current price */
  price: number;
  /** Price change percent */
  priceChange: number;
}

/** Signal explanation response */
export interface SignalExplanation {
  /** Plain English explanation */
  explanation: string;
  /** Key reasons */
  reasons: string[];
  /** Risk factors */
  risks: string[];
  /** Confidence in explanation */
  confidence: number;
  /** Cost of generation */
  cost: number;
}

/** Chat message */
export interface ChatMessage {
  /** Role of sender */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Timestamp */
  timestamp?: number;
}

/** Chat context */
export interface ChatContext {
  /** Conversation history */
  messages: ChatMessage[];
  /** Portfolio context */
  portfolio?: {
    totalValue: number;
    positions: Array<{ symbol: string; shares: number; value: number }>;
    cash: number;
  };
  /** Active signals */
  signals?: Array<{ symbol: string; action: string; strength: number }>;
}

/** Chat response */
export interface ChatResponse {
  /** Response message */
  message: string;
  /** Suggested follow-ups */
  suggestions?: string[];
  /** Referenced symbols */
  mentionedSymbols?: string[];
  /** Cost of generation */
  cost: number;
}

/** Cost tracking */
export interface UsageStats {
  /** Total requests made */
  totalRequests: number;
  /** Total tokens used */
  totalTokens: number;
  /** Total cost in USD */
  totalCost: number;
  /** Requests by model */
  requestsByModel: Map<string, number>;
  /** Cost by model */
  costByModel: Map<string, number>;
  /** Start of tracking period */
  periodStart: number;
}

/** Cost limits */
export interface CostLimits {
  /** Max cost per request */
  maxPerRequest: number;
  /** Max daily cost */
  maxDaily: number;
  /** Max monthly cost */
  maxMonthly: number;
  /** Fallback model when limit approached */
  fallbackModel?: string;
  /** Warning threshold (0-1) */
  warningThreshold: number;
}

/** Provider status */
export interface ProviderStatus {
  /** Is provider available */
  available: boolean;
  /** Last error if any */
  lastError?: string;
  /** Last successful call timestamp */
  lastSuccess?: number;
  /** Number of consecutive failures */
  consecutiveFailures: number;
}

/** Prompt template */
export interface PromptTemplate {
  /** Template name */
  name: string;
  /** System prompt */
  system: string;
  /** User prompt template (with {{placeholders}}) */
  user: string;
  /** Recommended temperature */
  temperature?: number;
  /** Recommended max tokens */
  maxTokens?: number;
}
