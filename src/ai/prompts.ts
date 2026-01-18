/**
 * Prompt Templates
 * Pre-defined prompts for various AI tasks
 */

import type { PromptTemplate } from './types';

/** Market analysis system prompt */
const MARKET_ANALYSIS_SYSTEM = `You are an experienced financial analyst providing market insights.
Your analysis should be:
- Objective and data-driven
- Clear and concise
- Focused on actionable insights
- Aware of risks and uncertainties

Always consider multiple perspectives and avoid overly bullish or bearish bias.`;

/** Signal explanation system prompt */
const SIGNAL_EXPLANATION_SYSTEM = `You are a quantitative trading assistant explaining trading signals.
Your explanations should be:
- Clear and understandable to non-experts
- Based on the specific factors driving the signal
- Honest about confidence levels and limitations
- Include relevant risks

Never provide investment advice - only explain the technical reasoning behind signals.`;

/** Chat assistant system prompt */
const CHAT_ASSISTANT_SYSTEM = `You are a helpful financial assistant for a quantitative trading platform.
You can:
- Explain market concepts and terminology
- Discuss portfolio composition and metrics
- Clarify trading signals and their factors
- Answer questions about the platform

You cannot:
- Provide investment advice or recommendations
- Predict future market movements
- Make promises about returns
- Access real-time market data directly

Always be helpful, accurate, and honest about your limitations.`;

/**
 * Pre-defined prompt templates
 */
export const PROMPTS: Record<string, PromptTemplate> = {
  marketSummary: {
    name: 'Market Summary',
    system: MARKET_ANALYSIS_SYSTEM,
    user: `Provide a concise market summary based on the following data:

Symbols: {{symbols}}
Price Changes: {{priceChanges}}
Headlines: {{headlines}}
Timeframe: {{timeframe}}

Structure your response as:
1. Overall Market Sentiment (1-2 sentences)
2. Key Highlights (3-5 bullet points)
3. Notable Movers (stocks with significant changes)
4. Risk Factors to Watch (2-3 points)

Keep the summary under 300 words.`,
    temperature: 0.5,
    maxTokens: 512,
  },

  signalExplanation: {
    name: 'Signal Explanation',
    system: SIGNAL_EXPLANATION_SYSTEM,
    user: `Explain the following trading signal in plain English:

Symbol: {{symbol}}
Action: {{action}}
Signal Strength: {{strength}}%
Current Price: USD {{price}}
Price Change: {{priceChange}}%

Factor Analysis:
{{factors}}

Provide:
1. A 2-3 sentence plain English explanation of why this signal was generated
2. The top 3 reasons supporting this signal
3. 2-3 risk factors to consider

Be concise and focus on what a trader needs to know.`,
    temperature: 0.3,
    maxTokens: 400,
  },

  chatResponse: {
    name: 'Chat Response',
    system: CHAT_ASSISTANT_SYSTEM,
    user: `{{context}}

User Question: {{question}}

Provide a helpful, concise response. If the question requires current market data you don't have access to, explain that and offer what insight you can based on general knowledge.`,
    temperature: 0.7,
    maxTokens: 300,
  },

  sentimentAnalysis: {
    name: 'Sentiment Analysis',
    system:
      'You are a precise financial sentiment analyzer. Respond only with JSON.',
    user: `Analyze the sentiment of this financial text:

"{{text}}"

Respond with ONLY this JSON format:
{
  "score": <-1 to 1>,
  "label": "<positive|negative|neutral>",
  "confidence": <0 to 1>,
  "keyPhrases": ["phrase1", "phrase2"],
  "breakdown": {"positive": 0.X, "negative": 0.X, "neutral": 0.X}
}`,
    temperature: 0.1,
    maxTokens: 200,
  },

  stockAnalysis: {
    name: 'Stock Analysis',
    system: MARKET_ANALYSIS_SYSTEM,
    user: `Analyze the following stock data:

Symbol: {{symbol}}
Current Price: USD {{price}}
52-Week Range: USD {{low52w}} - USD {{high52w}}
Market Cap: {{marketCap}}
P/E Ratio: {{peRatio}}
Sector: {{sector}}

Recent Performance:
{{performance}}

Factor Scores:
{{factorScores}}

Provide:
1. A brief overview of the stock's current position
2. Key strengths (2-3 points)
3. Key concerns (2-3 points)
4. Technical outlook

Keep the analysis under 250 words.`,
    temperature: 0.4,
    maxTokens: 400,
  },

  portfolioReview: {
    name: 'Portfolio Review',
    system: MARKET_ANALYSIS_SYSTEM,
    user: `Review this portfolio composition:

Total Value: USD {{totalValue}}
Cash: USD {{cash}} ({{cashPercent}}%)
Positions: {{positionCount}}

Holdings:
{{holdings}}

Sector Allocation:
{{sectorAllocation}}

Provide:
1. Diversification assessment
2. Concentration risks
3. Sector exposure analysis
4. General observations

This is informational analysis only, not investment advice.`,
    temperature: 0.5,
    maxTokens: 450,
  },
};

/**
 * Render a prompt template with values
 */
export function renderPrompt(
  template: PromptTemplate,
  values: Record<string, string | number | undefined>
): { system: string; user: string } {
  let user = template.user;

  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{{${key}}}`;
    const replacement = value?.toString() ?? '';
    user = user.replace(new RegExp(placeholder, 'g'), replacement);
  }

  return {
    system: template.system,
    user,
  };
}

/**
 * Get a prompt template by name
 */
export function getPrompt(name: string): PromptTemplate | undefined {
  return PROMPTS[name];
}

/**
 * List available prompt names
 */
export function listPrompts(): string[] {
  return Object.keys(PROMPTS);
}

/**
 * Create a custom prompt template
 */
export function createPrompt(
  name: string,
  system: string,
  user: string,
  options: { temperature?: number; maxTokens?: number } = {}
): PromptTemplate {
  return {
    name,
    system,
    user,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  };
}
