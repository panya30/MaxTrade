/**
 * API Middleware
 * Common middleware for the Hono API server
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ApiResponse, ApiError } from './types';

// ============ Request ID ============

/** Generate unique request ID */
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Request ID middleware - adds unique ID to each request */
export const requestId: MiddlewareHandler = async (c: Context, next: Next) => {
  const id = c.req.header('X-Request-ID') ?? generateRequestId();
  c.set('requestId', id);
  c.header('X-Request-ID', id);
  await next();
};

// ============ Request Logging ============

/** Logger configuration */
export interface LoggerConfig {
  /** Log request body */
  logBody?: boolean;
  /** Skip logging for paths */
  skipPaths?: string[];
  /** Custom log function */
  logFn?: (message: string, data: Record<string, unknown>) => void;
}

/** Request logger middleware */
export function logger(config: LoggerConfig = {}): MiddlewareHandler {
  const { logBody = false, skipPaths = ['/api/health'], logFn = console.log } = config;

  return async (c: Context, next: Next) => {
    const path = c.req.path;

    // Skip logging for certain paths
    if (skipPaths.some((p) => path.startsWith(p))) {
      return next();
    }

    const start = Date.now();
    const requestId = c.get('requestId') ?? 'unknown';

    const logData: Record<string, unknown> = {
      requestId,
      method: c.req.method,
      path,
      query: Object.fromEntries(new URL(c.req.url).searchParams),
    };

    if (logBody && ['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
      try {
        const body = await c.req.json();
        logData.body = body;
      } catch {
        // Ignore body parse errors
      }
    }

    logFn(`→ ${c.req.method} ${path}`, logData);

    await next();

    const duration = Date.now() - start;
    logFn(`← ${c.req.method} ${path} ${c.res.status} (${duration}ms)`, {
      requestId,
      status: c.res.status,
      duration,
    });
  };
}

// ============ Error Handling ============

/** Error response helper */
export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiError {
  return { code, message, details };
}

/** Global error handler middleware */
export const errorHandler: MiddlewareHandler = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    const requestId = c.get('requestId') ?? 'unknown';

    // Handle HTTP exceptions
    if (error instanceof HTTPException) {
      const response: ApiResponse = {
        success: false,
        error: errorResponse(
          `HTTP_${error.status}`,
          error.message,
          { status: error.status }
        ),
        meta: { timestamp: Date.now(), requestId },
      };
      return c.json(response, error.status);
    }

    // Handle validation errors (Zod)
    if (error instanceof Error && error.name === 'ZodError') {
      const zodError = error as unknown as { errors: Array<{ path: string[]; message: string }> };
      const response: ApiResponse = {
        success: false,
        error: errorResponse('VALIDATION_ERROR', 'Invalid request data', {
          errors: zodError.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        }),
        meta: { timestamp: Date.now(), requestId },
      };
      return c.json(response, 400);
    }

    // Handle generic errors
    console.error('Unhandled error:', error);
    const response: ApiResponse = {
      success: false,
      error: errorResponse(
        'INTERNAL_ERROR',
        'An unexpected error occurred',
        process.env.NODE_ENV === 'development'
          ? { message: (error as Error).message }
          : undefined
      ),
      meta: { timestamp: Date.now(), requestId },
    };
    return c.json(response, 500);
  }
};

// ============ CORS ============

/** CORS configuration */
export interface CorsConfig {
  /** Allowed origins */
  origins?: string[];
  /** Allow credentials */
  credentials?: boolean;
  /** Allowed methods */
  methods?: string[];
  /** Allowed headers */
  headers?: string[];
  /** Max age for preflight cache */
  maxAge?: number;
}

/** CORS middleware */
export function cors(config: CorsConfig = {}): MiddlewareHandler {
  const {
    origins = ['*'],
    credentials = true,
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization', 'X-Request-ID'],
    maxAge = 86400,
  } = config;

  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin') ?? '';

    // Check if origin is allowed
    const allowedOrigin = origins.includes('*')
      ? '*'
      : origins.includes(origin)
        ? origin
        : null;

    if (allowedOrigin) {
      c.header('Access-Control-Allow-Origin', allowedOrigin);
    }

    if (credentials && allowedOrigin !== '*') {
      c.header('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight
    if (c.req.method === 'OPTIONS') {
      c.header('Access-Control-Allow-Methods', methods.join(', '));
      c.header('Access-Control-Allow-Headers', headers.join(', '));
      c.header('Access-Control-Max-Age', maxAge.toString());
      return c.text('', 204);
    }

    await next();
  };
}

// ============ Rate Limiting ============

/** Rate limit configuration */
export interface RateLimitConfig {
  /** Window size in milliseconds */
  windowMs?: number;
  /** Max requests per window */
  max?: number;
  /** Key generator function */
  keyGenerator?: (c: Context) => string;
  /** Skip function */
  skip?: (c: Context) => boolean;
}

/** In-memory rate limit store */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/** Rate limiter middleware */
export function rateLimit(config: RateLimitConfig = {}): MiddlewareHandler {
  const {
    windowMs = 60000, // 1 minute
    max = 100,
    keyGenerator = (c) => c.req.header('X-Forwarded-For') ?? 'unknown',
    skip = () => false,
  } = config;

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, windowMs);

  return async (c: Context, next: Next) => {
    if (skip(c)) {
      return next();
    }

    const key = keyGenerator(c);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    c.header('X-RateLimit-Limit', max.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, max - entry.count).toString());
    c.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

    if (entry.count > max) {
      const response: ApiResponse = {
        success: false,
        error: errorResponse(
          'RATE_LIMIT_EXCEEDED',
          'Too many requests, please try again later',
          { retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
        ),
        meta: { timestamp: now, requestId: c.get('requestId') ?? 'unknown' },
      };
      return c.json(response, 429);
    }

    await next();
  };
}

// ============ Response Time ============

/** Response time middleware - adds processing time to response */
export const responseTime: MiddlewareHandler = async (c: Context, next: Next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  c.header('X-Response-Time', `${duration}ms`);
};

// ============ Response Wrapper ============

/** Success response helper */
export function successResponse<T>(
  c: Context,
  data: T,
  status = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: Date.now(),
      requestId: c.get('requestId') ?? 'unknown',
    },
  };
  return c.json(response, status);
}

/** Paginated response helper */
export function paginatedResponse<T>(
  c: Context,
  items: T[],
  total: number,
  page: number,
  limit: number
): Response {
  const response: ApiResponse<{
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> = {
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    },
    meta: {
      timestamp: Date.now(),
      requestId: c.get('requestId') ?? 'unknown',
    },
  };
  return c.json(response);
}
