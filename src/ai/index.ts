/**
 * AI Module
 * LLM integration for sentiment analysis and market insights
 */

// Types
export type {
  LLMProviderType,
  OpenAIModel,
  LLMResponse,
  ModelInfo,
  ProviderConfig,
  GenerationOptions,
  SentimentResult,
  MarketSummaryRequest,
  MarketSummary,
  SignalExplanationRequest,
  SignalExplanation,
  ChatMessage,
  ChatContext,
  ChatResponse,
  UsageStats,
  CostLimits,
  ProviderStatus,
  PromptTemplate,
} from './types';

// Provider abstraction
export {
  LLMProvider,
  ProviderRegistry,
  providerRegistry,
  DEFAULT_OPTIONS,
} from './provider';

// OpenAI implementation
export {
  OpenAIProvider,
  createOpenAIProvider,
  createOpenAIProviderFromEnv,
} from './openai';

// Sentiment analysis
export {
  SentimentAnalyzer,
  createSentimentAnalyzer,
  type SentimentConfig,
} from './sentiment';

// Prompt templates
export {
  PROMPTS,
  renderPrompt,
  getPrompt,
  listPrompts,
  createPrompt,
} from './prompts';

// Cost management
export {
  CostTracker,
  createCostTracker,
  globalCostTracker,
  estimateCost,
  estimateTokens,
  formatCost,
  DEFAULT_LIMITS,
} from './costs';
