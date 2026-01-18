/**
 * API Routes
 * Route handlers for the REST API
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import {
  symbolSchema,
  paginationSchema,
  historicalRequestSchema,
  factorRequestSchema,
  screenRequestSchema,
  backtestRequestSchema,
  sentimentRequestSchema,
  chatRequestSchema,
  orderRequestSchema,
  type QuoteResponse,
  type HistoricalBar,
  type FactorResponse,
  type ScreenResult,
  type StrategyInfo,
  type BacktestResponse,
  type SentimentResponse,
  type ChatResponseData,
  type PortfolioResponse,
  type OrderResponse,
  type HealthResponse,
} from './types';
import { successResponse, paginatedResponse, errorResponse } from './middleware';
import type { ApiResponse } from './types';

// ============ App State Types ============

/** Application context variables */
interface AppVariables {
  requestId: string;
}

type AppEnv = { Variables: AppVariables };

// ============ Create Routers ============

/** Health routes */
export const healthRouter = new Hono<AppEnv>();

/** Market data routes */
export const marketRouter = new Hono<AppEnv>();

/** Factor routes */
export const factorRouter = new Hono<AppEnv>();

/** Strategy routes */
export const strategyRouter = new Hono<AppEnv>();

/** AI routes */
export const aiRouter = new Hono<AppEnv>();

/** Portfolio routes */
export const portfolioRouter = new Hono<AppEnv>();

// ============ Health Routes ============

const startTime = Date.now();

healthRouter.get('/', async (c) => {
  const uptime = Date.now() - startTime;

  const health: HealthResponse = {
    status: 'healthy',
    version: '1.0.0',
    uptime,
    services: {
      database: { status: 'connected', latency: 1 },
      cache: { status: 'connected', latency: 0 },
    },
  };

  return successResponse(c, health);
});

healthRouter.get('/ready', async (c) => {
  // Readiness probe - check if dependencies are available
  return successResponse(c, { ready: true });
});

healthRouter.get('/live', async (c) => {
  // Liveness probe - basic health check
  return successResponse(c, { alive: true });
});

// ============ Market Data Routes ============

marketRouter.get(
  '/quotes/:symbol',
  zValidator('param', z.object({ symbol: symbolSchema })),
  async (c) => {
    const { symbol } = c.req.valid('param');

    // Mock quote data - in production this would fetch from data service
    const quote: QuoteResponse = {
      symbol,
      price: 150 + Math.random() * 10,
      change: Math.random() * 5 - 2.5,
      changePercent: Math.random() * 3 - 1.5,
      volume: Math.floor(Math.random() * 10000000),
      timestamp: Date.now(),
    };

    return successResponse(c, quote);
  }
);

marketRouter.get(
  '/historical/:symbol',
  zValidator('param', z.object({ symbol: symbolSchema })),
  zValidator('query', historicalRequestSchema.pick({ startDate: true, endDate: true, interval: true })),
  async (c) => {
    const { symbol } = c.req.valid('param');
    const { startDate, endDate, interval } = c.req.valid('query');

    // Mock historical data
    const bars: HistoricalBar[] = [];
    const start = startDate ?? Date.now() - 30 * 24 * 60 * 60 * 1000;
    const end = endDate ?? Date.now();
    const intervalMs = interval === '1d' ? 86400000 : 3600000;

    let price = 150;
    for (let t = start; t <= end; t += intervalMs) {
      const change = (Math.random() - 0.5) * 5;
      price = Math.max(1, price + change);

      bars.push({
        timestamp: t,
        open: price - 1,
        high: price + 2,
        low: price - 2,
        close: price,
        volume: Math.floor(Math.random() * 1000000),
      });
    }

    return successResponse(c, { symbol, interval, bars });
  }
);

// ============ Factor Routes ============

factorRouter.get(
  '/:symbol',
  zValidator('param', z.object({ symbol: symbolSchema })),
  zValidator('query', factorRequestSchema.pick({ categories: true })),
  async (c) => {
    const { symbol } = c.req.valid('param');
    const { categories } = c.req.valid('query');

    // Mock factor data
    const allFactors: FactorResponse = {
      symbol,
      timestamp: Date.now(),
      factors: {
        momentum_20d: 5.2,
        momentum_60d: 12.8,
        rsi_14: 62,
        macd: 1.5,
        pe_ratio: 28.5,
        pb_ratio: 6.2,
        roe: 45,
        volatility_20d: 18.5,
      },
      categories: {
        momentum: { momentum_20d: 5.2, momentum_60d: 12.8 },
        technical: { rsi_14: 62, macd: 1.5 },
        value: { pe_ratio: 28.5, pb_ratio: 6.2 },
        quality: { roe: 45 },
        volatility: { volatility_20d: 18.5 },
      },
    };

    // Filter by categories if specified
    if (categories && categories.length > 0) {
      const filtered: typeof allFactors.categories = {};
      for (const cat of categories) {
        if (cat in allFactors.categories) {
          filtered[cat] = allFactors.categories[cat];
        }
      }
      allFactors.categories = filtered;
    }

    return successResponse(c, allFactors);
  }
);

factorRouter.post(
  '/screen',
  zValidator('json', screenRequestSchema),
  async (c) => {
    const { factors, limit } = c.req.valid('json');

    // Mock screening results
    const symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD'];
    const results: ScreenResult[] = symbols.slice(0, limit).map((symbol, i) => ({
      symbol,
      score: 100 - i * 10 + Math.random() * 5,
      factors: factors.reduce(
        (acc, f) => {
          acc[f.name] = Math.random() * 100;
          return acc;
        },
        {} as Record<string, number>
      ),
      rank: i + 1,
    }));

    return successResponse(c, results);
  }
);

// ============ Strategy Routes ============

strategyRouter.get('/', zValidator('query', paginationSchema), async (c) => {
  const { page, limit } = c.req.valid('query');

  // Mock strategy list
  const strategies: StrategyInfo[] = [
    {
      id: 'momentum',
      name: 'Momentum Strategy',
      description: 'Buy stocks with strong price momentum',
      category: 'momentum',
      parameters: [
        { name: 'lookbackPeriod', type: 'number', default: 20, description: 'Lookback period in days' },
        { name: 'topN', type: 'number', default: 10, description: 'Number of stocks to hold' },
      ],
    },
    {
      id: 'value',
      name: 'Value Strategy',
      description: 'Buy undervalued stocks based on fundamentals',
      category: 'value',
      parameters: [
        { name: 'maxPE', type: 'number', default: 20, description: 'Maximum P/E ratio' },
        { name: 'minROE', type: 'number', default: 15, description: 'Minimum ROE' },
      ],
    },
    {
      id: 'quality',
      name: 'Quality Strategy',
      description: 'Focus on high-quality companies',
      category: 'quality',
      parameters: [
        { name: 'minROE', type: 'number', default: 20, description: 'Minimum ROE' },
        { name: 'maxDebtToEquity', type: 'number', default: 1, description: 'Maximum debt-to-equity' },
      ],
    },
  ];

  const start = (page - 1) * limit;
  const items = strategies.slice(start, start + limit);

  return paginatedResponse(c, items, strategies.length, page, limit);
});

strategyRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  // Mock strategy detail
  const strategy: StrategyInfo = {
    id,
    name: `${id.charAt(0).toUpperCase() + id.slice(1)} Strategy`,
    description: `Strategy based on ${id} factors`,
    category: id,
    parameters: [
      { name: 'param1', type: 'number', default: 10, description: 'Parameter 1' },
    ],
  };

  return successResponse(c, strategy);
});

strategyRouter.post(
  '/backtest',
  zValidator('json', backtestRequestSchema),
  async (c) => {
    const { strategyId, symbols, startDate, endDate, initialCapital, config } = c.req.valid('json');

    // Mock backtest result
    const finalValue = initialCapital * (1 + Math.random() * 0.5);
    const result: BacktestResponse = {
      id: `bt_${Date.now()}`,
      strategyId,
      strategyName: `${strategyId.charAt(0).toUpperCase() + strategyId.slice(1)} Strategy`,
      metrics: {
        totalReturn: ((finalValue - initialCapital) / initialCapital) * 100,
        sharpeRatio: 1.2 + Math.random() * 0.5,
        maxDrawdown: 10 + Math.random() * 10,
        winRate: 55 + Math.random() * 10,
        totalTrades: Math.floor(Math.random() * 50) + 10,
      },
      equityCurve: Array.from({ length: 30 }, (_, i) => ({
        date: startDate + i * 86400000,
        equity: initialCapital * (1 + (i / 30) * 0.2 + (Math.random() - 0.5) * 0.1),
      })),
      trades: symbols.slice(0, 5).map((symbol) => ({
        timestamp: startDate + Math.random() * (endDate - startDate),
        symbol,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        quantity: Math.floor(Math.random() * 100) + 10,
        price: 100 + Math.random() * 100,
        pnl: Math.random() * 2000 - 1000,
      })),
    };

    return successResponse(c, result);
  }
);

// ============ AI Routes ============

aiRouter.post(
  '/sentiment',
  zValidator('json', sentimentRequestSchema),
  async (c) => {
    const { text } = c.req.valid('json');

    // Mock sentiment analysis
    const score = Math.random() * 2 - 1;
    const result: SentimentResponse = {
      score,
      label: score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral',
      confidence: 0.7 + Math.random() * 0.2,
      keyPhrases: ['growth', 'earnings', 'market'].slice(0, Math.floor(Math.random() * 3) + 1),
    };

    return successResponse(c, result);
  }
);

aiRouter.post(
  '/chat',
  zValidator('json', chatRequestSchema),
  async (c) => {
    const { message } = c.req.valid('json');

    // Mock chat response
    const result: ChatResponseData = {
      message: `I received your question: "${message.slice(0, 50)}...". As your trading assistant, I'm here to help analyze market trends and explain trading signals.`,
      suggestions: [
        'What are today\'s top momentum stocks?',
        'Explain the current market sentiment',
        'Show my portfolio performance',
      ],
    };

    return successResponse(c, result);
  }
);

// ============ Portfolio Routes ============

portfolioRouter.get('/', async (c) => {
  // Mock portfolio
  const portfolio: PortfolioResponse = {
    id: 'default',
    name: 'Main Portfolio',
    cash: 25000,
    totalValue: 125000,
    dayChange: 1250,
    dayChangePercent: 1.01,
    positions: [
      {
        symbol: 'AAPL',
        quantity: 100,
        avgCost: 145,
        currentPrice: 155,
        marketValue: 15500,
        unrealizedPnl: 1000,
        unrealizedPnlPercent: 6.9,
      },
      {
        symbol: 'GOOGL',
        quantity: 50,
        avgCost: 140,
        currentPrice: 145,
        marketValue: 7250,
        unrealizedPnl: 250,
        unrealizedPnlPercent: 3.57,
      },
    ],
  };

  return successResponse(c, portfolio);
});

portfolioRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  // Mock portfolio by ID
  const portfolio: PortfolioResponse = {
    id,
    name: `Portfolio ${id}`,
    cash: 10000,
    totalValue: 50000,
    dayChange: 500,
    dayChangePercent: 1.0,
    positions: [],
  };

  return successResponse(c, portfolio);
});

portfolioRouter.post(
  '/orders',
  zValidator('json', orderRequestSchema),
  async (c) => {
    const order = c.req.valid('json');

    // Mock order execution
    const result: OrderResponse = {
      id: `ord_${Date.now()}`,
      portfolioId: order.portfolioId,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: order.limitPrice ?? 150 + Math.random() * 5,
      status: 'filled',
      filledAt: Date.now(),
    };

    return successResponse(c, result, 201);
  }
);

portfolioRouter.get('/:id/trades', zValidator('query', paginationSchema), async (c) => {
  const id = c.req.param('id');
  const { page, limit } = c.req.valid('query');

  // Mock trade history
  const trades = Array.from({ length: 20 }, (_, i) => ({
    id: `trade_${i}`,
    portfolioId: id,
    symbol: ['AAPL', 'GOOGL', 'MSFT'][i % 3],
    side: i % 2 === 0 ? 'buy' : 'sell',
    quantity: Math.floor(Math.random() * 100) + 10,
    price: 100 + Math.random() * 100,
    timestamp: Date.now() - i * 86400000,
    pnl: i % 2 === 1 ? Math.random() * 500 - 200 : undefined,
  }));

  const start = (page - 1) * limit;
  const items = trades.slice(start, start + limit);

  return paginatedResponse(c, items, trades.length, page, limit);
});

// ============ Create Main App ============

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Mount routers
  app.route('/api/health', healthRouter);
  app.route('/api', marketRouter);  // Market router handles /quotes and /historical
  app.route('/api/factors', factorRouter);
  app.route('/api/strategies', strategyRouter);
  app.route('/api/ai', aiRouter);
  app.route('/api/portfolio', portfolioRouter);

  // 404 handler
  app.notFound((c) => {
    const response: ApiResponse = {
      success: false,
      error: errorResponse('NOT_FOUND', `Route ${c.req.path} not found`),
      meta: { timestamp: Date.now(), requestId: c.get('requestId') ?? 'unknown' },
    };
    return c.json(response, 404);
  });

  return app;
}
