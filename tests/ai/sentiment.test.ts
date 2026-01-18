/**
 * Sentiment Analyzer Tests
 */

import { describe, test, expect } from 'bun:test';
import { SentimentAnalyzer, createSentimentAnalyzer } from '../../src/ai/sentiment';

describe('SentimentAnalyzer', () => {
  describe('keyword analysis', () => {
    test('should detect positive sentiment', () => {
      const analyzer = createSentimentAnalyzer({ useLLM: false });
      const result = analyzer.analyzeKeyword('The market is bullish with strong gains');

      expect(result.score).toBeGreaterThan(0);
      expect(result.label).toBe('positive');
      expect(result.method).toBe('keyword');
      expect(result.keyPhrases.length).toBeGreaterThan(0);
    });

    test('should detect negative sentiment', () => {
      const analyzer = createSentimentAnalyzer({ useLLM: false });
      const result = analyzer.analyzeKeyword('Stock prices decline sharply amid bearish concerns');

      expect(result.score).toBeLessThan(0);
      expect(result.label).toBe('negative');
      expect(result.keyPhrases).toContain('decline');
    });

    test('should detect neutral sentiment', () => {
      const analyzer = createSentimentAnalyzer({ useLLM: false });
      const result = analyzer.analyzeKeyword('The market remains flat and stable');

      expect(result.label).toBe('neutral');
      expect(result.score).toBeGreaterThanOrEqual(-0.1);
      expect(result.score).toBeLessThanOrEqual(0.1);
    });

    test('should handle negation', () => {
      const analyzer = createSentimentAnalyzer({ useLLM: false });

      const positive = analyzer.analyzeKeyword('The stock shows strong growth');
      const negated = analyzer.analyzeKeyword('The stock does not show strong growth');

      expect(positive.score).toBeGreaterThan(negated.score);
    });

    test('should handle intensifiers', () => {
      const analyzer = createSentimentAnalyzer({ useLLM: false });

      const normal = analyzer.analyzeKeyword('The market shows bullish momentum');
      const intense = analyzer.analyzeKeyword('The market shows extremely bullish momentum');

      expect(intense.score).toBeGreaterThanOrEqual(normal.score);
    });

    test('should return breakdown', () => {
      const analyzer = createSentimentAnalyzer({ useLLM: false });
      const result = analyzer.analyzeKeyword('Strong gains despite some risk and concern');

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown!.positive).toBeGreaterThan(0);
      expect(result.breakdown!.negative).toBeGreaterThan(0);
    });

    test('should handle empty text', () => {
      const analyzer = createSentimentAnalyzer({ useLLM: false });
      const result = analyzer.analyzeKeyword('');

      expect(result.score).toBe(0);
      expect(result.confidence).toBe(0);
    });

    test('should handle text with no sentiment words', () => {
      const analyzer = createSentimentAnalyzer({ useLLM: false });
      const result = analyzer.analyzeKeyword('The company announced quarterly results');

      expect(result.confidence).toBe(0);
      expect(result.keyPhrases).toHaveLength(0);
    });
  });

  describe('custom keywords', () => {
    test('should use custom positive keywords', () => {
      const analyzer = createSentimentAnalyzer({
        useLLM: false,
        customPositive: ['moonshot', 'diamond hands'],
      });

      const result = analyzer.analyzeKeyword('This is a moonshot opportunity');

      expect(result.score).toBeGreaterThan(0);
      expect(result.keyPhrases).toContain('moonshot');
    });

    test('should use custom negative keywords', () => {
      const analyzer = createSentimentAnalyzer({
        useLLM: false,
        customNegative: ['rugpull', 'scam'],
      });

      const result = analyzer.analyzeKeyword('Watch out for potential rugpull');

      expect(result.score).toBeLessThan(0);
    });
  });

  describe('batch analysis', () => {
    test('should analyze multiple texts', async () => {
      const analyzer = createSentimentAnalyzer({ useLLM: false });
      const texts = [
        'Strong bullish momentum',
        'Bearish decline ahead',
        'Market remains stable',
      ];

      const results = await analyzer.analyzeBatch(texts);

      expect(results).toHaveLength(3);
      expect(results[0].label).toBe('positive');
      expect(results[1].label).toBe('negative');
      expect(results[2].label).toBe('neutral');
    });
  });

  describe('aggregate analysis', () => {
    test('should aggregate multiple results', async () => {
      const analyzer = createSentimentAnalyzer({ useLLM: false });
      const texts = [
        'Very bullish outlook with strong gains',
        'Slight concern about volatility',
        'Overall positive momentum',
      ];

      const result = await analyzer.analyzeAggregate(texts);

      expect(result.score).toBeGreaterThan(0); // Overall positive
      expect(result.keyPhrases.length).toBeGreaterThan(0);
    });

    test('should handle empty array', async () => {
      const analyzer = createSentimentAnalyzer({ useLLM: false });
      const result = await analyzer.analyzeAggregate([]);

      expect(result.score).toBe(0);
      expect(result.label).toBe('neutral');
    });
  });

  describe('factory function', () => {
    test('should create analyzer with defaults', () => {
      const analyzer = createSentimentAnalyzer();
      expect(analyzer).toBeInstanceOf(SentimentAnalyzer);
    });

    test('should create analyzer with config', () => {
      const analyzer = createSentimentAnalyzer({
        useLLM: false,
        confidenceThreshold: 0.9,
      });
      expect(analyzer).toBeInstanceOf(SentimentAnalyzer);
    });
  });
});
