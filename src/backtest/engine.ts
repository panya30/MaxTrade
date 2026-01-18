/**
 * Backtest Engine
 * Core simulation engine for strategy backtesting
 */

import type {
  BacktestConfig,
  BacktestResult,
  BacktestData,
  EquityPoint,
  PriceBar,
  CommissionConfig,
  SlippageConfig,
} from './types';
import type { Signal, StrategyResult } from '../strategies/types';
import { Portfolio, DEFAULT_COMMISSION, DEFAULT_SLIPPAGE } from './portfolio';
import { calculateMetrics, calculateBenchmarkComparison, calculateMonthlyReturns } from './metrics';

/** Default backtest configuration */
export const DEFAULT_CONFIG: BacktestConfig = {
  initialCapital: 100000,
  commission: DEFAULT_COMMISSION,
  slippage: DEFAULT_SLIPPAGE,
  positionSizing: 'equal_weight',
  maxPositions: 20,
  maxPositionPercent: 10,
  rebalanceFrequency: 'daily',
  allowFractional: true, // Enable by default for crypto/fractional share support
  riskFreeRate: 0.02,
};

export class BacktestEngine {
  private config: BacktestConfig;
  private portfolio: Portfolio;
  private equityCurve: EquityPoint[] = [];
  private benchmarkPrices: number[] = [];

  constructor(
    config: Partial<BacktestConfig> & {
      commission?: number | CommissionConfig;
      slippage?: number | SlippageConfig;
    } = {}
  ) {
    // Normalize commission - convert number to CommissionConfig
    const commission = this.normalizeCommissionConfig(config.commission);
    // Normalize slippage - convert number to SlippageConfig
    const slippage = this.normalizeSlippageConfig(config.slippage);

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      commission,
      slippage,
    };
    this.portfolio = new Portfolio(
      this.config.initialCapital,
      this.config.commission,
      this.config.slippage,
      this.config.allowFractional
    );
  }

  /**
   * Normalize commission config - handles both number and object formats
   */
  private normalizeCommissionConfig(
    config: number | CommissionConfig | undefined
  ): CommissionConfig {
    if (config === undefined) {
      return DEFAULT_COMMISSION;
    }
    if (typeof config === 'number') {
      return {
        fixedFee: 0,
        percentFee: config,
        minCommission: 0,
        maxCommission: Infinity,
      };
    }
    return config;
  }

  /**
   * Normalize slippage config - handles both number and object formats
   */
  private normalizeSlippageConfig(config: number | SlippageConfig | undefined): SlippageConfig {
    if (config === undefined) {
      return DEFAULT_SLIPPAGE;
    }
    if (typeof config === 'number') {
      return {
        fixed: 0,
        percent: config,
        randomize: false,
      };
    }
    return config;
  }

  /**
   * Run backtest with signals from a strategy
   */
  run(
    data: BacktestData,
    signalGenerator: (date: number, prices: Map<string, PriceBar>) => Signal[]
  ): BacktestResult {
    // Reset state
    this.portfolio.reset(this.config.initialCapital);
    this.equityCurve = [];
    this.benchmarkPrices = [];

    // Get all unique dates
    const allDates = this.getUniqueDates(data.prices);
    const tradingDates = allDates.filter((d) => d >= data.startDate && d <= data.endDate);

    if (tradingDates.length === 0) {
      return this.createEmptyResult();
    }

    // Run simulation
    let prevEquity = this.config.initialCapital;

    for (let i = 0; i < tradingDates.length; i++) {
      const date = tradingDates[i];
      const currentPrices = this.getPricesForDate(data.prices, date);

      // Update portfolio prices
      this.portfolio.updatePrices(currentPrices, date);

      // Check if we should rebalance
      const shouldRebalance = this.shouldRebalance(i, tradingDates);

      if (shouldRebalance) {
        // Generate signals
        const priceBars = this.getPriceBarsForDate(data.prices, date);
        const signals = signalGenerator(date, priceBars);

        // Execute signals
        this.executeSignals(signals, currentPrices, date);
      }

      // Record equity point
      const equity = this.portfolio.getTotalValue();
      const cash = this.portfolio.getCash();
      const dailyReturn = prevEquity > 0 ? ((equity - prevEquity) / prevEquity) * 100 : 0;
      const cumulativeReturn =
        ((equity - this.config.initialCapital) / this.config.initialCapital) * 100;

      // Calculate drawdown
      const peak = Math.max(this.config.initialCapital, ...this.equityCurve.map((p) => p.equity));
      const drawdown = ((peak - equity) / peak) * 100;

      this.equityCurve.push({
        date,
        equity,
        cash,
        invested: equity - cash,
        dailyReturn,
        cumulativeReturn,
        drawdown,
      });

      // Track benchmark if available
      if (data.prices.has('SPY') || data.prices.has('benchmark')) {
        const benchmarkSymbol = data.prices.has('SPY') ? 'SPY' : 'benchmark';
        const benchmarkPrice = currentPrices.get(benchmarkSymbol);
        if (benchmarkPrice) {
          this.benchmarkPrices.push(benchmarkPrice);
        }
      }

      prevEquity = equity;
    }

    // Close all positions at end
    const finalDate = tradingDates[tradingDates.length - 1];
    const finalPrices = this.getPricesForDate(data.prices, finalDate);
    this.portfolio.closeAll(finalPrices, finalDate);

    // Calculate final metrics
    return this.createResult();
  }

  /**
   * Run backtest with pre-generated strategy results
   */
  runWithStrategy(
    data: BacktestData,
    strategyResults: Map<number, StrategyResult>
  ): BacktestResult {
    return this.run(data, (date) => {
      const result = strategyResults.get(date);
      return result?.signals ?? [];
    });
  }

  /**
   * Normalize a signal to ensure it has the expected properties
   * Supports both action/direction and confidence/strength formats
   */
  private normalizeSignal(signal: Signal | Record<string, unknown>): Signal {
    const s = signal as Record<string, unknown>;

    // Normalize action: support both 'action' and 'direction' properties
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    if (s.action === 'buy' || s.action === 'sell' || s.action === 'hold') {
      action = s.action;
    } else if (s.direction === 'long' || s.direction === 'buy') {
      action = 'buy';
    } else if (s.direction === 'short' || s.direction === 'sell') {
      action = 'sell';
    }

    // Normalize confidence: support both 'confidence' and 'strength'
    const confidence =
      typeof s.confidence === 'number'
        ? s.confidence
        : typeof s.strength === 'number'
          ? s.strength
          : 0.5;

    return {
      symbol: String(s.symbol ?? ''),
      action,
      confidence,
      strength: typeof s.strength === 'number' ? s.strength : confidence,
      factors: Array.isArray(s.factors) ? s.factors : [],
      timestamp: typeof s.timestamp === 'number' ? s.timestamp : Date.now(),
      metadata:
        typeof s.metadata === 'object' ? (s.metadata as Record<string, unknown>) : undefined,
    };
  }

  /**
   * Execute signals
   */
  private executeSignals(signals: Signal[], prices: Map<string, number>, date: number): void {
    // Normalize all signals to handle various input formats
    const normalizedSignals = signals.map((s) => this.normalizeSignal(s));

    // Sort by confidence (highest first)
    const sortedSignals = [...normalizedSignals].sort((a, b) => b.confidence - a.confidence);

    // Process sell signals first
    const sellSignals = sortedSignals.filter((s) => s.action === 'sell');
    for (const signal of sellSignals) {
      const price = prices.get(signal.symbol);
      const position = this.portfolio.getPosition(signal.symbol);

      if (price && position && position.quantity > 0) {
        this.portfolio.sell(signal.symbol, position.quantity, price, date);
      }
    }

    // Process buy signals
    const buySignals = sortedSignals.filter((s) => s.action === 'buy');
    const currentPositions = this.portfolio.getPositions();

    // Calculate how many new positions we can open
    const availableSlots = this.config.maxPositions - currentPositions.length;
    const signalsToExecute = buySignals.slice(0, availableSlots);

    for (const signal of signalsToExecute) {
      const price = prices.get(signal.symbol);
      if (!price) continue;

      // Check if we already have this position
      const existingPosition = this.portfolio.getPosition(signal.symbol);
      if (existingPosition) continue;

      // Calculate position size
      const quantity = this.calculatePositionSize(signal, price, signalsToExecute.length);

      if (quantity > 0) {
        this.portfolio.buy(signal.symbol, quantity, price, date);
      }
    }
  }

  /**
   * Calculate position size based on config
   */
  private calculatePositionSize(signal: Signal, price: number, totalSignals: number): number {
    const portfolioValue = this.portfolio.getTotalValue();
    const cash = this.portfolio.getCash();
    let targetValue: number;

    switch (this.config.positionSizing) {
      case 'fixed':
        targetValue = this.config.fixedPositionSize ?? 10000;
        break;

      case 'percent':
        targetValue = portfolioValue * ((this.config.positionSizePercent ?? 5) / 100);
        break;

      case 'equal_weight':
        // Divide available capital equally among signals
        targetValue = cash / Math.max(1, totalSignals);
        break;

      case 'kelly': {
        // Simplified Kelly: use confidence as win probability
        const kellyFraction = signal.confidence - (1 - signal.confidence);
        targetValue = portfolioValue * Math.max(0, kellyFraction * 0.25); // Quarter Kelly
        break;
      }

      default:
        targetValue = portfolioValue * 0.05;
    }

    // Apply max position constraint
    const maxValue = portfolioValue * (this.config.maxPositionPercent / 100);
    targetValue = Math.min(targetValue, maxValue, cash);

    let quantity = targetValue / price;

    // If not allowing fractional and quantity < 1, try to buy 1 whole unit
    // if affordable (useful for expensive assets like BTC)
    if (!this.config.allowFractional && quantity < 1 && quantity > 0) {
      if (price <= cash) {
        quantity = 1;
      }
    }

    return quantity;
  }

  /**
   * Check if we should rebalance on this date
   */
  private shouldRebalance(dayIndex: number, dates: number[]): boolean {
    if (dayIndex === 0) return true; // Always trade on first day

    switch (this.config.rebalanceFrequency) {
      case 'daily':
        return true;

      case 'weekly': {
        // Check if week changed
        const prevWeek = this.getWeekNumber(dates[dayIndex - 1]);
        const currWeek = this.getWeekNumber(dates[dayIndex]);
        return prevWeek !== currWeek;
      }

      case 'monthly': {
        // Check if month changed
        const prevMonth = new Date(dates[dayIndex - 1]).getMonth();
        const currMonth = new Date(dates[dayIndex]).getMonth();
        return prevMonth !== currMonth;
      }

      case 'quarterly': {
        const prevQuarter = Math.floor(new Date(dates[dayIndex - 1]).getMonth() / 3);
        const currQuarter = Math.floor(new Date(dates[dayIndex]).getMonth() / 3);
        return prevQuarter !== currQuarter;
      }

      case 'never':
        return dayIndex === 0;

      default:
        return true;
    }
  }

  /**
   * Get week number from timestamp
   */
  private getWeekNumber(timestamp: number): number {
    const date = new Date(timestamp);
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + firstDay.getDay() + 1) / 7);
  }

  /**
   * Get all unique dates from price data
   */
  private getUniqueDates(prices: Map<string, PriceBar[]>): number[] {
    const dateSet = new Set<number>();

    for (const bars of prices.values()) {
      for (const bar of bars) {
        dateSet.add(bar.timestamp);
      }
    }

    return Array.from(dateSet).sort((a, b) => a - b);
  }

  /**
   * Get closing prices for a specific date
   */
  private getPricesForDate(prices: Map<string, PriceBar[]>, date: number): Map<string, number> {
    const result = new Map<string, number>();

    for (const [symbol, bars] of prices) {
      const bar = bars.find((b) => b.timestamp === date);
      if (bar) {
        result.set(symbol, bar.close);
      }
    }

    return result;
  }

  /**
   * Get full price bars for a specific date
   */
  private getPriceBarsForDate(
    prices: Map<string, PriceBar[]>,
    date: number
  ): Map<string, PriceBar> {
    const result = new Map<string, PriceBar>();

    for (const [symbol, bars] of prices) {
      const bar = bars.find((b) => b.timestamp === date);
      if (bar) {
        result.set(symbol, bar);
      }
    }

    return result;
  }

  /**
   * Create backtest result
   */
  private createResult(): BacktestResult {
    const trades = this.portfolio.getTrades();
    const metrics = calculateMetrics(
      this.equityCurve,
      trades,
      this.config.initialCapital,
      this.config.riskFreeRate
    );

    const benchmark =
      this.benchmarkPrices.length > 0
        ? calculateBenchmarkComparison(
            this.equityCurve,
            this.benchmarkPrices,
            this.config.riskFreeRate
          )
        : undefined;

    const monthlyReturns = calculateMonthlyReturns(this.equityCurve);

    return {
      config: { ...this.config },
      metrics,
      benchmark,
      equityCurve: this.equityCurve,
      monthlyReturns,
      trades,
      finalPositions: this.portfolio.getPositions(),
    };
  }

  /**
   * Create empty result
   */
  private createEmptyResult(): BacktestResult {
    return {
      config: { ...this.config },
      metrics: calculateMetrics([], [], this.config.initialCapital),
      equityCurve: [],
      monthlyReturns: [],
      trades: [],
      finalPositions: [],
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): BacktestConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<BacktestConfig>): void {
    this.config = { ...this.config, ...config };
    this.portfolio = new Portfolio(
      this.config.initialCapital,
      this.config.commission,
      this.config.slippage,
      this.config.allowFractional
    );
  }
}

/** Create a new backtest engine */
export function createBacktestEngine(config: Partial<BacktestConfig> = {}): BacktestEngine {
  return new BacktestEngine(config);
}
