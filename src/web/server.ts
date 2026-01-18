/**
 * API Server
 * Main entry point for the Hono REST API server
 */

import { Hono } from 'hono';
import {
  healthRouter,
  marketRouter,
  factorRouter,
  strategyRouter,
  aiRouter,
  portfolioRouter,
} from './routes';
import {
  requestId,
  logger,
  errorHandler,
  cors,
  rateLimit,
  responseTime,
} from './middleware';
import type { ApiResponse } from './types';
import { errorResponse } from './middleware';

/** Application context variables */
interface AppVariables {
  requestId: string;
}

type AppEnv = { Variables: AppVariables };

/** Server configuration */
export interface ServerConfig {
  /** Port to listen on */
  port?: number;
  /** Enable request logging */
  logging?: boolean;
  /** CORS origins */
  corsOrigins?: string[];
  /** Rate limit (requests per minute) */
  rateLimit?: number;
  /** Log function */
  logFn?: (message: string, data: Record<string, unknown>) => void;
}

const DEFAULT_CONFIG: ServerConfig = {
  port: 3000,
  logging: true,
  corsOrigins: ['*'],
  rateLimit: 100,
};

/**
 * Create configured server instance
 */
export function createServer(config: ServerConfig = {}): Hono {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const app = new Hono<AppEnv>();

  // Apply middleware in order BEFORE routes

  // 1. Request ID (first, so all other middleware can use it)
  app.use('*', requestId);

  // 2. Response time tracking
  app.use('*', responseTime);

  // 3. CORS
  app.use('*', cors({ origins: cfg.corsOrigins }));

  // 4. Rate limiting
  if (cfg.rateLimit && cfg.rateLimit > 0) {
    app.use(
      '/api/*',
      rateLimit({
        max: cfg.rateLimit,
        skip: (c) => c.req.path.startsWith('/api/health'),
      })
    );
  }

  // 5. Request logging
  if (cfg.logging) {
    app.use(
      '*',
      logger({
        skipPaths: ['/api/health/live', '/api/health/ready'],
        logFn: cfg.logFn,
      })
    );
  }

  // 6. Error handling
  app.use('*', errorHandler);

  // Mount routes AFTER middleware
  app.route('/api/health', healthRouter);
  app.route('/api', marketRouter);
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

/**
 * Start the server
 */
export function startServer(config: ServerConfig = {}): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const app = createServer(cfg);

  console.log(`
╔═══════════════════════════════════════════════╗
║                                               ║
║   MaxTrade API Server                         ║
║                                               ║
║   Port: ${cfg.port?.toString().padEnd(6)}                            ║
║   Environment: ${(process.env.NODE_ENV ?? 'development').padEnd(15)}        ║
║                                               ║
╚═══════════════════════════════════════════════╝
  `);

  console.log('Available endpoints:');
  console.log('  GET  /api/health           - Health check');
  console.log('  GET  /api/health/ready     - Readiness probe');
  console.log('  GET  /api/health/live      - Liveness probe');
  console.log('  GET  /api/quotes/:symbol   - Get quote');
  console.log('  GET  /api/historical/:sym  - Historical data');
  console.log('  GET  /api/factors/:symbol  - Factor data');
  console.log('  POST /api/factors/screen   - Factor screening');
  console.log('  GET  /api/strategies       - List strategies');
  console.log('  POST /api/backtest         - Run backtest');
  console.log('  POST /api/ai/sentiment     - Sentiment analysis');
  console.log('  POST /api/ai/chat          - Chat with AI');
  console.log('  GET  /api/portfolio        - Get portfolio');
  console.log('  POST /api/orders           - Place order');
  console.log('');

  Bun.serve({
    port: cfg.port,
    fetch: app.fetch,
  });

  console.log(`Server listening on http://localhost:${cfg.port}`);
}

// Start server if run directly
if (import.meta.main) {
  startServer({
    port: parseInt(process.env.PORT ?? '3000', 10),
    logging: process.env.NODE_ENV !== 'test',
  });
}
