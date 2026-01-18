/**
 * API Client
 * HTTP client for the MaxTrade API
 */

import type {
  ApiResponse,
  Quote,
  HistoricalBar,
  FactorData,
  ScreenResult,
  Strategy,
  BacktestResult,
  SentimentResult,
  ChatResponse,
  Portfolio,
  Order,
  Trade,
  HealthStatus,
  PaginatedResponse,
} from './types';

const API_BASE = '/api';

/** Fetch wrapper with error handling */
async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message ?? 'API error');
  }

  return data.data as T;
}

/** Health API */
export const healthApi = {
  getStatus: () => fetchApi<HealthStatus>('/health'),
  getReady: () => fetchApi<{ ready: boolean }>('/health/ready'),
  getLive: () => fetchApi<{ alive: boolean }>('/health/live'),
};

/** Market Data API */
export const marketApi = {
  getQuote: (symbol: string) => fetchApi<Quote>(`/quotes/${symbol}`),

  getHistorical: (
    symbol: string,
    params?: { startDate?: number; endDate?: number; interval?: string }
  ) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', String(params.startDate));
    if (params?.endDate) query.set('endDate', String(params.endDate));
    if (params?.interval) query.set('interval', params.interval);
    const queryStr = query.toString();
    return fetchApi<{ symbol: string; interval: string; bars: HistoricalBar[] }>(
      `/historical/${symbol}${queryStr ? `?${queryStr}` : ''}`
    );
  },
};

/** Factor API */
export const factorApi = {
  getFactors: (symbol: string, categories?: string[]) => {
    const query = categories?.length
      ? `?categories=${categories.join(',')}`
      : '';
    return fetchApi<FactorData>(`/factors/${symbol}${query}`);
  },

  screen: (filters: {
    factors: Array<{ name: string; min?: number; max?: number; weight?: number }>;
    symbols?: string[];
    limit?: number;
  }) =>
    fetchApi<ScreenResult[]>('/factors/screen', {
      method: 'POST',
      body: JSON.stringify(filters),
    }),
};

/** Strategy API */
export const strategyApi = {
  list: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const queryStr = query.toString();
    return fetchApi<PaginatedResponse<Strategy>>(
      `/strategies${queryStr ? `?${queryStr}` : ''}`
    );
  },

  get: (id: string) => fetchApi<Strategy>(`/strategies/${id}`),

  backtest: (params: {
    strategyId: string;
    symbols: string[];
    startDate: number;
    endDate: number;
    initialCapital?: number;
    config?: Record<string, unknown>;
  }) =>
    fetchApi<BacktestResult>('/strategies/backtest', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

/** AI API */
export const aiApi = {
  analyzeSentiment: (text: string) =>
    fetchApi<SentimentResult>('/ai/sentiment', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  chat: (message: string, context?: { portfolioId?: string; symbols?: string[] }) =>
    fetchApi<ChatResponse>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    }),
};

/** Portfolio API */
export const portfolioApi = {
  get: () => fetchApi<Portfolio>('/portfolio'),

  getById: (id: string) => fetchApi<Portfolio>(`/portfolio/${id}`),

  placeOrder: (params: {
    portfolioId: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    type?: 'market' | 'limit';
    limitPrice?: number;
  }) =>
    fetchApi<Order>('/portfolio/orders', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getTrades: (portfolioId: string, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const queryStr = query.toString();
    return fetchApi<PaginatedResponse<Trade>>(
      `/portfolio/${portfolioId}/trades${queryStr ? `?${queryStr}` : ''}`
    );
  },
};
