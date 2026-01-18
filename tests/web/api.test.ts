/**
 * API Tests
 * Integration tests for REST API endpoints
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createServer } from '../../src/web/server';
import type { ApiResponse, QuoteResponse, FactorResponse, PortfolioResponse } from '../../src/web/types';

describe('API Server', () => {
  const app = createServer({ logging: false });

  const request = async (
    path: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    return app.fetch(
      new Request(`http://localhost${path}`, options)
    );
  };

  const json = async <T>(res: Response): Promise<ApiResponse<T>> => {
    return res.json();
  };

  describe('Health endpoints', () => {
    test('GET /api/health should return health status', async () => {
      const res = await request('/api/health');
      const data = await json<{ status: string }>(res);

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.status).toBe('healthy');
    });

    test('GET /api/health/ready should return ready', async () => {
      const res = await request('/api/health/ready');
      const data = await json<{ ready: boolean }>(res);

      expect(res.status).toBe(200);
      expect(data.data?.ready).toBe(true);
    });

    test('GET /api/health/live should return alive', async () => {
      const res = await request('/api/health/live');
      const data = await json<{ alive: boolean }>(res);

      expect(res.status).toBe(200);
      expect(data.data?.alive).toBe(true);
    });
  });

  describe('Market data endpoints', () => {
    test('GET /api/quotes/:symbol should return quote', async () => {
      const res = await request('/api/quotes/AAPL');
      const data = await json<QuoteResponse>(res);

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.symbol).toBe('AAPL');
      expect(data.data?.price).toBeGreaterThan(0);
      expect(data.data?.timestamp).toBeGreaterThan(0);
    });

    test('GET /api/historical/:symbol should return bars', async () => {
      const res = await request('/api/historical/AAPL');
      const data = await json<{ symbol: string; bars: unknown[] }>(res);

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.symbol).toBe('AAPL');
      expect(Array.isArray(data.data?.bars)).toBe(true);
    });

    test('GET /api/historical/:symbol with params should work', async () => {
      const endDate = Date.now();
      const startDate = endDate - 7 * 86400000;
      const res = await request(
        `/api/historical/GOOGL?startDate=${startDate}&endDate=${endDate}&interval=1d`
      );
      const data = await json<{ symbol: string; interval: string }>(res);

      expect(res.status).toBe(200);
      expect(data.data?.symbol).toBe('GOOGL');
      expect(data.data?.interval).toBe('1d');
    });
  });

  describe('Factor endpoints', () => {
    test('GET /api/factors/:symbol should return factors', async () => {
      const res = await request('/api/factors/AAPL');
      const data = await json<FactorResponse>(res);

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.symbol).toBe('AAPL');
      expect(data.data?.factors).toBeDefined();
      expect(data.data?.categories).toBeDefined();
    });

    test('POST /api/factors/screen should return results', async () => {
      const res = await request('/api/factors/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factors: [
            { name: 'momentum', min: 0 },
            { name: 'pe_ratio', max: 30 },
          ],
          limit: 5,
        }),
      });
      const data = await json<Array<{ symbol: string; score: number }>>(res);

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data?.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Strategy endpoints', () => {
    test('GET /api/strategies should return paginated list', async () => {
      const res = await request('/api/strategies');
      const data = await json<{
        items: unknown[];
        total: number;
        page: number;
        limit: number;
      }>(res);

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data?.items)).toBe(true);
      expect(data.data?.page).toBe(1);
    });

    test('GET /api/strategies with pagination', async () => {
      const res = await request('/api/strategies?page=1&limit=2');
      const data = await json<{ items: unknown[]; limit: number }>(res);

      expect(res.status).toBe(200);
      expect(data.data?.items.length).toBeLessThanOrEqual(2);
      expect(data.data?.limit).toBe(2);
    });

    test('GET /api/strategies/:id should return strategy', async () => {
      const res = await request('/api/strategies/momentum');
      const data = await json<{ id: string; name: string }>(res);

      expect(res.status).toBe(200);
      expect(data.data?.id).toBe('momentum');
    });

    test('POST /api/backtest should run backtest', async () => {
      const res = await request('/api/strategies/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: 'momentum',
          symbols: ['AAPL', 'GOOGL'],
          startDate: Date.now() - 365 * 86400000,
          endDate: Date.now(),
          initialCapital: 100000,
        }),
      });
      const data = await json<{
        id: string;
        metrics: { totalReturn: number };
      }>(res);

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.id).toBeDefined();
      expect(data.data?.metrics?.totalReturn).toBeDefined();
    });
  });

  describe('AI endpoints', () => {
    test('POST /api/ai/sentiment should analyze text', async () => {
      const res = await request('/api/ai/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'The market is showing strong bullish momentum with solid gains.',
        }),
      });
      const data = await json<{ score: number; label: string }>(res);

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(typeof data.data?.score).toBe('number');
      expect(['positive', 'negative', 'neutral']).toContain(data.data?.label);
    });

    test('POST /api/ai/chat should respond', async () => {
      const res = await request('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'What are the best momentum stocks today?',
        }),
      });
      const data = await json<{ message: string }>(res);

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.message).toBeDefined();
    });
  });

  describe('Portfolio endpoints', () => {
    test('GET /api/portfolio should return portfolio', async () => {
      const res = await request('/api/portfolio');
      const data = await json<PortfolioResponse>(res);

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.totalValue).toBeGreaterThan(0);
      expect(Array.isArray(data.data?.positions)).toBe(true);
    });

    test('GET /api/portfolio/:id should return specific portfolio', async () => {
      const res = await request('/api/portfolio/test123');
      const data = await json<PortfolioResponse>(res);

      expect(res.status).toBe(200);
      expect(data.data?.id).toBe('test123');
    });

    test('POST /api/orders should place order', async () => {
      const res = await request('/api/portfolio/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId: 'default',
          symbol: 'AAPL',
          side: 'buy',
          quantity: 10,
          type: 'market',
        }),
      });
      const data = await json<{ id: string; status: string }>(res);

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data?.id).toBeDefined();
      expect(data.data?.status).toBe('filled');
    });

    test('GET /api/portfolio/:id/trades should return trade history', async () => {
      const res = await request('/api/portfolio/default/trades');
      const data = await json<{ items: unknown[]; total: number }>(res);

      expect(res.status).toBe(200);
      expect(Array.isArray(data.data?.items)).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('should return 404 for unknown routes', async () => {
      const res = await request('/api/unknown');
      const data = await json<never>(res);

      expect(res.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('NOT_FOUND');
    });

    test('should return validation error for invalid input', async () => {
      const res = await request('/api/ai/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '' }), // Empty text
      });

      expect(res.status).toBe(400);
    });

    test('should return validation error for missing required fields', async () => {
      const res = await request('/api/portfolio/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          // Missing portfolioId, side, quantity
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('Response metadata', () => {
    test('should include metadata in response', async () => {
      const res = await request('/api/health');
      const data = await json<unknown>(res);

      expect(data.meta).toBeDefined();
      expect(data.meta?.timestamp).toBeGreaterThan(0);
      expect(data.meta?.requestId).toBeDefined();
    });

    test('should include response time header', async () => {
      const res = await request('/api/health');
      const responseTime = res.headers.get('X-Response-Time');

      expect(responseTime).toBeDefined();
      expect(responseTime).toMatch(/^\d+ms$/);
    });

    test('should include request ID header', async () => {
      const res = await request('/api/health');
      const requestId = res.headers.get('X-Request-ID');

      expect(requestId).toBeDefined();
    });
  });

  describe('CORS', () => {
    test('should handle preflight requests', async () => {
      const res = await request('/api/health', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:5173' },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });

    test('should include CORS headers in response', async () => {
      const res = await request('/api/health', {
        headers: { Origin: 'http://localhost:5173' },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });
  });
});
