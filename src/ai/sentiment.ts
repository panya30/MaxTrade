/**
 * Sentiment Analyzer
 * Financial sentiment analysis with LLM and keyword fallback
 */

import type { SentimentResult, GenerationOptions } from './types';
import type { LLMProvider } from './provider';

/** Financial keyword categories */
const FINANCIAL_KEYWORDS = {
  positive: [
    // Market sentiment
    'bullish',
    'rally',
    'surge',
    'gain',
    'growth',
    'upturn',
    'boom',
    'soar',
    'jump',
    'climb',
    // Performance
    'beat',
    'exceed',
    'outperform',
    'strong',
    'robust',
    'solid',
    'impressive',
    'stellar',
    // Actions
    'upgrade',
    'buy',
    'accumulate',
    'breakout',
    'recovery',
    // Fundamentals
    'profit',
    'revenue growth',
    'earnings beat',
    'dividend increase',
    'buyback',
  ],
  negative: [
    // Market sentiment
    'bearish',
    'decline',
    'drop',
    'loss',
    'weak',
    'downturn',
    'crash',
    'plunge',
    'slump',
    'tumble',
    // Performance
    'miss',
    'underperform',
    'disappoint',
    'concern',
    'worry',
    'risk',
    'warning',
    'caution',
    // Actions
    'downgrade',
    'sell',
    'avoid',
    'breakdown',
    // Fundamentals
    'debt',
    'default',
    'bankruptcy',
    'layoff',
    'restructure',
    'writedown',
  ],
  neutral: [
    'hold',
    'stable',
    'unchanged',
    'flat',
    'mixed',
    'sideways',
    'consolidate',
    'range-bound',
  ],
};

/** Intensity modifiers */
const INTENSIFIERS: Record<string, number> = {
  very: 1.5,
  extremely: 2.0,
  highly: 1.5,
  significantly: 1.5,
  slightly: 0.5,
  somewhat: 0.5,
  marginally: 0.3,
  strongly: 1.5,
  sharply: 1.5,
};

/** Negation words */
const NEGATIONS = [
  'not',
  "n't",
  'no',
  'never',
  'neither',
  'without',
  'lack',
  'fail',
  'unable',
];

/** Sentiment analyzer configuration */
export interface SentimentConfig {
  /** Use LLM when available */
  useLLM: boolean;
  /** LLM provider to use */
  provider?: LLMProvider;
  /** Confidence threshold for LLM fallback */
  confidenceThreshold: number;
  /** Custom positive keywords to add */
  customPositive?: string[];
  /** Custom negative keywords to add */
  customNegative?: string[];
}

const DEFAULT_CONFIG: SentimentConfig = {
  useLLM: true,
  confidenceThreshold: 0.7,
};

/**
 * Sentiment Analyzer
 * Analyzes financial text sentiment with LLM and keyword fallback
 */
export class SentimentAnalyzer {
  private config: SentimentConfig;
  private positiveKeywords: Set<string>;
  private negativeKeywords: Set<string>;
  private neutralKeywords: Set<string>;

  constructor(config: Partial<SentimentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Build keyword sets
    this.positiveKeywords = new Set([
      ...FINANCIAL_KEYWORDS.positive,
      ...(config.customPositive ?? []),
    ]);
    this.negativeKeywords = new Set([
      ...FINANCIAL_KEYWORDS.negative,
      ...(config.customNegative ?? []),
    ]);
    this.neutralKeywords = new Set(FINANCIAL_KEYWORDS.neutral);
  }

  /**
   * Analyze sentiment of text
   */
  async analyze(text: string): Promise<SentimentResult> {
    // Try LLM first if configured
    if (this.config.useLLM && this.config.provider?.isAvailable()) {
      try {
        const llmResult = await this.analyzeLLM(text);
        if (llmResult.confidence >= this.config.confidenceThreshold) {
          return llmResult;
        }
        // Low confidence, fall through to keyword
      } catch {
        // LLM failed, fall through to keyword
      }
    }

    // Keyword-based fallback
    return this.analyzeKeyword(text);
  }

  /**
   * Analyze sentiment using LLM
   */
  private async analyzeLLM(text: string): Promise<SentimentResult> {
    const provider = this.config.provider!;

    const prompt = `Analyze the financial sentiment of the following text. Respond with ONLY a JSON object in this exact format:
{
  "score": <number between -1 and 1>,
  "label": "<positive|negative|neutral>",
  "confidence": <number between 0 and 1>,
  "keyPhrases": ["phrase1", "phrase2"],
  "breakdown": {"positive": <0-1>, "negative": <0-1>, "neutral": <0-1>}
}

Text to analyze:
"${text}"

Important: The score should be:
- Positive (0.1 to 1.0) for bullish/optimistic sentiment
- Negative (-1.0 to -0.1) for bearish/pessimistic sentiment
- Neutral (-0.1 to 0.1) for neutral sentiment

Respond with ONLY the JSON, no other text.`;

    const options: GenerationOptions = {
      temperature: 0.1,
      maxTokens: 256,
      systemPrompt:
        'You are a financial sentiment analyzer. Provide precise, objective sentiment analysis.',
    };

    const response = await provider.generate(prompt, options);

    try {
      // Parse JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        score: Math.max(-1, Math.min(1, result.score)),
        label: this.scoreToLabel(result.score),
        confidence: result.confidence ?? 0.8,
        keyPhrases: result.keyPhrases ?? [],
        method: 'llm',
        breakdown: result.breakdown,
      };
    } catch {
      // If parsing fails, throw to trigger fallback
      throw new Error('Failed to parse LLM response');
    }
  }

  /**
   * Analyze sentiment using keywords
   */
  analyzeKeyword(text: string): SentimentResult {
    const words = this.tokenize(text);
    const keyPhrases: string[] = [];

    let positiveScore = 0;
    let negativeScore = 0;
    let neutralScore = 0;
    let totalMatches = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase();

      // Check for negation in previous 3 words
      const isNegated = this.checkNegation(words, i);

      // Get intensity modifier
      const intensity = this.getIntensity(words, i);

      // Check sentiment categories
      if (this.positiveKeywords.has(word)) {
        const score = intensity * (isNegated ? -1 : 1);
        if (isNegated) {
          negativeScore += Math.abs(score);
        } else {
          positiveScore += score;
        }
        keyPhrases.push(word);
        totalMatches++;
      } else if (this.negativeKeywords.has(word)) {
        const score = intensity * (isNegated ? -1 : 1);
        if (isNegated) {
          positiveScore += Math.abs(score);
        } else {
          negativeScore += score;
        }
        keyPhrases.push(word);
        totalMatches++;
      } else if (this.neutralKeywords.has(word)) {
        neutralScore += 1;
        keyPhrases.push(word);
        totalMatches++;
      }
    }

    // Calculate final score
    const total = positiveScore + negativeScore + neutralScore;
    let score = 0;
    let confidence = 0;

    if (total > 0) {
      score = (positiveScore - negativeScore) / total;
      // Confidence increases with more matches, maxes at 0.9 for keyword
      confidence = Math.min(0.9, 0.3 + totalMatches * 0.1);
    }

    // Normalize breakdown
    const breakdownTotal = positiveScore + negativeScore + neutralScore || 1;

    return {
      score: Math.max(-1, Math.min(1, score)),
      label: this.scoreToLabel(score),
      confidence,
      keyPhrases: [...new Set(keyPhrases)].slice(0, 10),
      method: 'keyword',
      breakdown: {
        positive: positiveScore / breakdownTotal,
        negative: negativeScore / breakdownTotal,
        neutral: neutralScore / breakdownTotal,
      },
    };
  }

  /**
   * Batch analyze multiple texts
   */
  async analyzeBatch(texts: string[]): Promise<SentimentResult[]> {
    // For efficiency, use keyword analysis for batch
    return texts.map((text) => this.analyzeKeyword(text));
  }

  /**
   * Get aggregated sentiment for multiple texts
   */
  async analyzeAggregate(texts: string[]): Promise<SentimentResult> {
    const results = await this.analyzeBatch(texts);

    if (results.length === 0) {
      return {
        score: 0,
        label: 'neutral',
        confidence: 0,
        keyPhrases: [],
        method: 'keyword',
      };
    }

    // Weighted average by confidence
    let totalWeight = 0;
    let weightedScore = 0;
    const allPhrases: string[] = [];

    let positiveSum = 0;
    let negativeSum = 0;
    let neutralSum = 0;

    for (const result of results) {
      const weight = result.confidence;
      totalWeight += weight;
      weightedScore += result.score * weight;
      allPhrases.push(...result.keyPhrases);

      if (result.breakdown) {
        positiveSum += result.breakdown.positive;
        negativeSum += result.breakdown.negative;
        neutralSum += result.breakdown.neutral;
      }
    }

    const avgScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const count = results.length;

    return {
      score: avgScore,
      label: this.scoreToLabel(avgScore),
      confidence: totalWeight / count,
      keyPhrases: [...new Set(allPhrases)].slice(0, 20),
      method: 'keyword',
      breakdown: {
        positive: positiveSum / count,
        negative: negativeSum / count,
        neutral: neutralSum / count,
      },
    };
  }

  /**
   * Set LLM provider
   */
  setProvider(provider: LLMProvider): void {
    this.config.provider = provider;
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0);
  }

  /**
   * Check if word is negated
   */
  private checkNegation(words: string[], index: number): boolean {
    const lookback = Math.min(3, index);
    for (let i = index - lookback; i < index; i++) {
      if (i >= 0 && NEGATIONS.some((neg) => words[i].includes(neg))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get intensity modifier
   */
  private getIntensity(words: string[], index: number): number {
    if (index === 0) return 1;
    const prevWord = words[index - 1].toLowerCase();
    return INTENSIFIERS[prevWord] ?? 1;
  }

  /**
   * Convert score to label
   */
  private scoreToLabel(score: number): 'positive' | 'negative' | 'neutral' {
    if (score > 0.1) return 'positive';
    if (score < -0.1) return 'negative';
    return 'neutral';
  }
}

/**
 * Create sentiment analyzer instance
 */
export function createSentimentAnalyzer(
  config: Partial<SentimentConfig> = {}
): SentimentAnalyzer {
  return new SentimentAnalyzer(config);
}
