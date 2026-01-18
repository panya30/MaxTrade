/**
 * API Hooks
 * TanStack Query hooks for data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  healthApi,
  marketApi,
  factorApi,
  strategyApi,
  aiApi,
  portfolioApi,
} from '../lib/api';

// Query Keys
export const queryKeys = {
  health: ['health'] as const,
  quote: (symbol: string) => ['quote', symbol] as const,
  historical: (symbol: string) => ['historical', symbol] as const,
  factors: (symbol: string) => ['factors', symbol] as const,
  strategies: ['strategies'] as const,
  strategy: (id: string) => ['strategy', id] as const,
  portfolio: ['portfolio'] as const,
  portfolioById: (id: string) => ['portfolio', id] as const,
  trades: (portfolioId: string) => ['trades', portfolioId] as const,
};

// Health Hooks
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: healthApi.getStatus,
    refetchInterval: 30000,
  });
}

// Market Data Hooks
export function useQuote(symbol: string) {
  return useQuery({
    queryKey: queryKeys.quote(symbol),
    queryFn: () => marketApi.getQuote(symbol),
    enabled: !!symbol,
    refetchInterval: 5000,
  });
}

export function useHistorical(
  symbol: string,
  params?: { startDate?: number; endDate?: number; interval?: string }
) {
  return useQuery({
    queryKey: [...queryKeys.historical(symbol), params],
    queryFn: () => marketApi.getHistorical(symbol, params),
    enabled: !!symbol,
  });
}

// Factor Hooks
export function useFactors(symbol: string, categories?: string[]) {
  return useQuery({
    queryKey: [...queryKeys.factors(symbol), categories],
    queryFn: () => factorApi.getFactors(symbol, categories),
    enabled: !!symbol,
  });
}

export function useScreen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: factorApi.screen,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screen'] });
    },
  });
}

// Strategy Hooks
export function useStrategies(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: [...queryKeys.strategies, params],
    queryFn: () => strategyApi.list(params),
  });
}

export function useStrategy(id: string) {
  return useQuery({
    queryKey: queryKeys.strategy(id),
    queryFn: () => strategyApi.get(id),
    enabled: !!id,
  });
}

export function useBacktest() {
  return useMutation({
    mutationFn: strategyApi.backtest,
  });
}

// AI Hooks
export function useSentiment() {
  return useMutation({
    mutationFn: aiApi.analyzeSentiment,
  });
}

export function useChat() {
  return useMutation({
    mutationFn: ({ message, context }: Parameters<typeof aiApi.chat>[0] extends string
      ? { message: string; context?: Parameters<typeof aiApi.chat>[1] }
      : never) => aiApi.chat(message, context),
  });
}

// Portfolio Hooks
export function usePortfolio() {
  return useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: portfolioApi.get,
    refetchInterval: 10000,
  });
}

export function usePortfolioById(id: string) {
  return useQuery({
    queryKey: queryKeys.portfolioById(id),
    queryFn: () => portfolioApi.getById(id),
    enabled: !!id,
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: portfolioApi.placeOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio });
    },
  });
}

export function useTrades(portfolioId: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: [...queryKeys.trades(portfolioId), params],
    queryFn: () => portfolioApi.getTrades(portfolioId, params),
    enabled: !!portfolioId,
  });
}
