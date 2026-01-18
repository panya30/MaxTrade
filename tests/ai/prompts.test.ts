/**
 * Prompt Templates Tests
 */

import { describe, test, expect } from 'bun:test';
import {
  PROMPTS,
  renderPrompt,
  getPrompt,
  listPrompts,
  createPrompt,
} from '../../src/ai/prompts';

describe('PROMPTS', () => {
  test('should have required templates', () => {
    expect(PROMPTS).toHaveProperty('marketSummary');
    expect(PROMPTS).toHaveProperty('signalExplanation');
    expect(PROMPTS).toHaveProperty('chatResponse');
    expect(PROMPTS).toHaveProperty('sentimentAnalysis');
    expect(PROMPTS).toHaveProperty('stockAnalysis');
    expect(PROMPTS).toHaveProperty('portfolioReview');
  });

  test('should have valid structure', () => {
    for (const [name, template] of Object.entries(PROMPTS)) {
      expect(template.name).toBeDefined();
      expect(template.system).toBeDefined();
      expect(template.user).toBeDefined();
      expect(typeof template.system).toBe('string');
      expect(typeof template.user).toBe('string');
      expect(template.system.length).toBeGreaterThan(0);
      expect(template.user.length).toBeGreaterThan(0);
    }
  });
});

describe('renderPrompt', () => {
  test('should replace placeholders', () => {
    const template = createPrompt('test', 'System', 'Hello {{name}}, you are {{age}} years old');

    const result = renderPrompt(template, { name: 'Alice', age: 30 });

    expect(result.user).toBe('Hello Alice, you are 30 years old');
    expect(result.system).toBe('System');
  });

  test('should handle multiple occurrences', () => {
    const template = createPrompt('test', 'System', '{{name}} said {{name}} likes {{thing}}');

    const result = renderPrompt(template, { name: 'Bob', thing: 'coding' });

    expect(result.user).toBe('Bob said Bob likes coding');
  });

  test('should handle missing values', () => {
    const template = createPrompt('test', 'System', 'Hello {{name}}, value: {{value}}');

    const result = renderPrompt(template, { name: 'Test' });

    // Missing values stay as placeholders (not replaced with empty string)
    expect(result.user).toBe('Hello Test, value: {{value}}');
  });

  test('should handle numeric values', () => {
    const template = createPrompt('test', 'System', 'Price: USD {{price}}, Change: {{change}}%');

    const result = renderPrompt(template, { price: 150.50, change: -2.5 });

    expect(result.user).toBe('Price: USD 150.5, Change: -2.5%');
  });

  test('should render market summary template', () => {
    const template = PROMPTS.marketSummary;
    const result = renderPrompt(template, {
      symbols: 'AAPL, GOOGL, MSFT',
      priceChanges: '+2.5%, -1.2%, +0.5%',
      headlines: 'Tech stocks rally',
      timeframe: 'daily',
    });

    expect(result.user).toContain('AAPL, GOOGL, MSFT');
    expect(result.user).toContain('daily');
    expect(result.system.length).toBeGreaterThan(0);
  });

  test('should render signal explanation template', () => {
    const template = PROMPTS.signalExplanation;
    const result = renderPrompt(template, {
      symbol: 'AAPL',
      action: 'buy',
      strength: 85,
      price: 150,
      priceChange: 2.5,
      factors: 'Momentum: High, RSI: 65',
    });

    expect(result.user).toContain('AAPL');
    expect(result.user).toContain('buy');
    expect(result.user).toContain('85');
  });
});

describe('getPrompt', () => {
  test('should get existing prompt', () => {
    const prompt = getPrompt('marketSummary');

    expect(prompt).toBeDefined();
    expect(prompt!.name).toBe('Market Summary');
  });

  test('should return undefined for non-existent prompt', () => {
    const prompt = getPrompt('nonExistent');
    expect(prompt).toBeUndefined();
  });
});

describe('listPrompts', () => {
  test('should list all prompt names', () => {
    const names = listPrompts();

    expect(names).toContain('marketSummary');
    expect(names).toContain('signalExplanation');
    expect(names).toContain('chatResponse');
    expect(names.length).toBeGreaterThanOrEqual(6);
  });
});

describe('createPrompt', () => {
  test('should create prompt with required fields', () => {
    const prompt = createPrompt('Custom', 'You are helpful', 'Answer: {{question}}');

    expect(prompt.name).toBe('Custom');
    expect(prompt.system).toBe('You are helpful');
    expect(prompt.user).toBe('Answer: {{question}}');
  });

  test('should create prompt with options', () => {
    const prompt = createPrompt('Custom', 'System', 'User', {
      temperature: 0.5,
      maxTokens: 256,
    });

    expect(prompt.temperature).toBe(0.5);
    expect(prompt.maxTokens).toBe(256);
  });

  test('should have undefined options by default', () => {
    const prompt = createPrompt('Custom', 'System', 'User');

    expect(prompt.temperature).toBeUndefined();
    expect(prompt.maxTokens).toBeUndefined();
  });
});
